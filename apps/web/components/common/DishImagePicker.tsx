"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  RefreshCw,
  SwitchCamera,
  Check,
  AlertCircle,
} from "lucide-react";
import { FOOD_PRESET_OPTIONS } from "@/lib/food-images";

interface DishImagePickerProps {
  imageUrl: string;
  onChange: (url: string) => void;
  dishName?: string;
}

// Compress and resize an image file or video frame into a compact data URL (JPEG/WebP)
export async function compressImage(
  imageSource: HTMLImageElement | HTMLVideoElement | File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Unable to create canvas context"));
      return;
    }

    const processElement = (element: HTMLImageElement | HTMLVideoElement) => {
      let srcWidth = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
      let srcHeight = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;

      // Robust fallback if dimensions are 0 (e.g. video initializing or canvas element)
      if (!srcWidth || !srcHeight) {
        if (element instanceof HTMLVideoElement) {
          srcWidth = element.clientWidth || (element as any).width || 640;
          srcHeight = element.clientHeight || (element as any).height || 480;
        } else {
          srcWidth = element.width || 640;
          srcHeight = element.height || 480;
        }
      }

      if (!srcWidth || !srcHeight || srcWidth <= 0 || srcHeight <= 0) {
        srcWidth = 640;
        srcHeight = 480;
      }

      let targetWidth = srcWidth;
      let targetHeight = srcHeight;

      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw and compress
      ctx.drawImage(element, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };

    if (imageSource instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => processElement(img);
        img.onerror = () => reject(new Error("Failed to load image file"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(imageSource);
    } else {
      processElement(imageSource);
    }
  });
}

export const DishImagePicker: React.FC<DishImagePickerProps> = ({
  imageUrl,
  onChange,
  dishName,
}) => {
  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "presets">("camera");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Stop media stream tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start media stream
  const startCamera = useCallback(async (facing: "environment" | "user" = cameraFacing) => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this browser.");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch {
          // ignore play promise restriction
        }
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn("Camera start error, offering native capture fallback:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in browser settings or use Upload."
          : "Could not start live camera feed. You can use the Phone Camera Click button below."
      );
      setIsCameraActive(false);
    }
  }, [cameraFacing, stopCamera]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Capture photo from video stream
  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      // Wait for video frame to be ready if still loading
      if (video.readyState < 2) {
        await new Promise<void>((res) => {
          const onLoaded = () => {
            video.removeEventListener("loadeddata", onLoaded);
            res();
          };
          video.addEventListener("loadeddata", onLoaded);
          setTimeout(res, 300);
        });
      }

      const dataUrl = await compressImage(video, 800, 800, 0.85);
      onChange(dataUrl);
      stopCamera();
    } catch (err) {
      console.error("Capture photo error:", err);
      setCameraError("Failed to capture photo.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle front/back camera
  const handleFlipCamera = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Handle file upload from gallery or native file picker
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const dataUrl = await compressImage(file, 800, 800, 0.85);
      onChange(dataUrl);
      if (e.target) e.target.value = "";
    } catch (err) {
      console.error("File processing error:", err);
      alert("Failed to process image file.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Label and Clear / Preview Header */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300">
          Dish Photo
        </label>
        {imageUrl && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              stopCamera();
            }}
            className="text-[11px] font-mono text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <X className="h-3 w-3" />
            <span>Remove Photo</span>
          </button>
        )}
      </div>

      {/* Current Preview Banner */}
      {imageUrl && !isCameraActive && (
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#C9AE8B]/60 dark:border-stone-700 bg-stone-900 h-40 flex items-center justify-center shadow-xs">
          <img
            src={imageUrl}
            alt={dishName || "Dish Preview"}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md border border-white/20">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>Photo Attached</span>
          </div>
        </div>
      )}

      {/* Tab Navigation for Image Input Methods */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#EFE7DC] dark:bg-stone-900 p-1 border border-[#C9AE8B]/30 dark:border-stone-800">
        <button
          type="button"
          onClick={() => {
            setActiveTab("camera");
          }}
          className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "camera"
              ? "bg-[#B72E35] text-white shadow-xs"
              : "text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Camera</span>
        </button>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setActiveTab("upload");
          }}
          className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "upload"
              ? "bg-[#B72E35] text-white shadow-xs"
              : "text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Upload File</span>
        </button>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setActiveTab("presets");
          }}
          className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "presets"
              ? "bg-[#B72E35] text-white shadow-xs"
              : "text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Presets / URL</span>
        </button>
      </div>

      {/* Hidden File Inputs */}
      {/* 1. Standard file upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />
      {/* 2. Direct mobile camera capture */}
      <input
        type="file"
        ref={nativeCameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* TAB 1: CAMERA */}
      {activeTab === "camera" && (
        <div className="space-y-2">
          {isCameraActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-black border border-stone-800 shadow-md">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-56 object-cover"
              />

              {/* Camera Action Overlay Controls */}
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-4 px-4">
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer border border-white/20"
                  title="Switch Camera (Front / Rear)"
                >
                  <SwitchCamera className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#B72E35] text-white font-mono text-xs font-bold hover:bg-[#9E2329] transition shadow-lg cursor-pointer border border-white/30 active:scale-95"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <span>Click Photo</span>
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer border border-white/20"
                  title="Close Camera"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Live in-app Camera */}
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-[#B72E35] hover:bg-[#FAF4EB] dark:hover:bg-stone-800 transition cursor-pointer text-center group"
                >
                  <div className="h-9 w-9 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#B72E35] dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition">
                    <Camera className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-white">
                    Open Live Camera
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    Snap directly from webcam
                  </span>
                </button>

                {/* Mobile Camera Device Trigger */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-[#B72E35] hover:bg-[#FAF4EB] dark:hover:bg-stone-800 transition cursor-pointer text-center group"
                >
                  <div className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
                    <Check className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-white">
                    Phone Camera Click
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    Opens phone camera app
                  </span>
                </button>
              </div>

              {cameraError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-[11px] font-mono">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD FILE */}
      {activeTab === "upload" && (
        <div className="space-y-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-[#B72E35] hover:bg-[#FAF4EB] dark:hover:bg-stone-800 transition cursor-pointer text-center"
          >
            <div className="h-10 w-10 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-white block">
                Choose Image File
              </span>
              <span className="text-[10.5px] font-mono text-stone-500 block mt-0.5">
                PNG, JPG, WebP from photo library or computer
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRESETS & URL */}
      {activeTab === "presets" && (
        <div className="space-y-2.5">
          {/* Direct URL Input */}
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://images.unsplash.com/... or choose preset"
              value={imageUrl}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <span className="text-[10px] font-mono text-stone-500 block mb-1">
              Food Image Presets:
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {FOOD_PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onChange(opt.url)}
                  className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition font-mono cursor-pointer ${
                    imageUrl === opt.url
                      ? "bg-[#B72E35] text-white border-[#B72E35]"
                      : "bg-white dark:bg-stone-900 border-[#C9AE8B]/40 dark:border-stone-700 text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
