"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

export const AppSplashScreen: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(12);
  const [tapScale, setTapScale] = useState(false);

  // States narrative milestone
  const states = [
    { threshold: 22, message: "warming the terracotta cups...", sub: "Selected small-batch ceramic stoneware" },
    { threshold: 48, message: "steaming fresh beans...", sub: "100% ethically sourced Arabica beans" },
    { threshold: 76, message: "brewing your smol moments...", sub: "Extracting notes of caramel and hazelnut" },
    { threshold: 94, message: "pouring velvety foam...", sub: "Crafting the perfect morning silhouette" },
    { threshold: 100, message: "your table is ready!", sub: "Welcome back to your cozy corner ✨" }
  ];

  useEffect(() => {
    // Check if splash has already run in this session
    try {
      const alreadyShown = sessionStorage.getItem("smol_splash_shown");
      if (alreadyShown === "true") {
        setIsVisible(false);
        return;
      }
    } catch {
      // safe
    }

    // 5-second total loading progress simulation
    const totalDurationMs = 4800;
    const intervalMs = 100;
    const increment = (100 / (totalDurationMs / intervalMs));

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment + (Math.random() * 1.5 - 0.5);
        if (next >= 100) {
          clearInterval(timer);
          return 100;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, []);

  // When progress reaches 100%, trigger smooth exit
  useEffect(() => {
    if (progress >= 100) {
      const exitTimer = setTimeout(() => {
        handleDismiss();
      }, 500);
      return () => clearTimeout(exitTimer);
    }
  }, [progress]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    try {
      sessionStorage.setItem("smol_splash_shown", "true");
    } catch {
      // safe
    }
    setTimeout(() => {
      setIsVisible(false);
    }, 450);
  };

  const handleAccelerate = () => {
    setTapScale(true);
    setTimeout(() => setTapScale(false), 200);

    setProgress((prev) => {
      const boosted = Math.min(prev + 30, 100);
      if (boosted >= 100) {
        setTimeout(handleDismiss, 200);
      }
      return boosted;
    });
  };

  if (!isVisible) return null;

  const currentMilestone = states.find((s) => Math.round(progress) <= s.threshold) || states[states.length - 1];
  const roundedPercent = Math.min(Math.round(progress), 100);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col justify-between overflow-hidden select-none bg-gradient-to-b from-[#FFFDF9] via-[#FAF3EA] to-[#F3E7D8] dark:from-[#201A17] dark:via-[#181412] dark:to-[#100D0C] text-[#2B2320] dark:text-[#F3E7D3] font-sans transition-all duration-500 ease-out ${
        isFadingOut ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      <style>{`
        @keyframes bouncySquash {
          0%, 100% {
            transform: translateY(0px) scale(1, 1);
            animation-timing-function: cubic-bezier(0.28, 0.84, 0.42, 1);
          }
          35% {
            transform: translateY(-22px) scale(0.96, 1.05);
            animation-timing-function: cubic-bezier(0.75, 0.05, 0.85, 0.35);
          }
          65% {
            transform: translateY(0px) scale(1.08, 0.92);
            animation-timing-function: cubic-bezier(0.28, 0.84, 0.42, 1);
          }
          78% {
            transform: translateY(-8px) scale(0.98, 1.02);
          }
          88% {
            transform: translateY(0px) scale(1.02, 0.98);
          }
        }

        @keyframes dynamicShadow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.28;
          }
          35% {
            transform: scale(0.65);
            opacity: 0.12;
          }
          65% {
            transform: scale(1.15);
            opacity: 0.38;
          }
          78% {
            transform: scale(0.85);
            opacity: 0.2;
          }
          88% {
            transform: scale(1.04);
            opacity: 0.3;
          }
        }

        @keyframes gentleSteam {
          0% {
            transform: translateY(0) scaleX(1);
            opacity: 0;
          }
          25% {
            opacity: 0.65;
          }
          50% {
            transform: translateY(-18px) scaleX(1.3) translateX(3px);
            opacity: 0.4;
          }
          75% {
            transform: translateY(-34px) scaleX(0.85) translateX(-4px);
            opacity: 0.2;
          }
          100% {
            transform: translateY(-48px) scaleX(0.6);
            opacity: 0;
          }
        }

        @keyframes shimmerBar {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        @keyframes ambientHalo {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.7;
          }
        }

        .animate-bouncy-logo {
          animation: bouncySquash 2.4s ease-in-out infinite;
          transform-origin: bottom center;
        }

        .animate-bouncy-shadow {
          animation: dynamicShadow 2.4s ease-in-out infinite;
        }

        .steam-wisp-1 {
          animation: gentleSteam 2.8s ease-out infinite;
        }

        .steam-wisp-2 {
          animation: gentleSteam 2.8s ease-out infinite 0.9s;
        }

        .steam-wisp-3 {
          animation: gentleSteam 2.8s ease-out infinite 1.7s;
        }

        .shimmer-active {
          background: linear-gradient(
            90deg,
            #C93834 0%,
            #e35752 45%,
            #fce8e6 55%,
            #C93834 70%,
            #A82A26 100%
          );
          background-size: 240% 100%;
          animation: shimmerBar 2.2s infinite linear;
        }

        .pulse-halo {
          animation: ambientHalo 4s ease-in-out infinite;
        }
      `}</style>

      {/* Warm Ambient Halo Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-orange-300/35 dark:bg-[#B72E35]/20 blur-3xl pulse-halo"
      />

      {/* Top Safe Area Spacer */}
      <div className="h-[env(safe-area-inset-top,0px)] shrink-0" />

      {/* Main Centerpiece Logo Hero Area */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* Steam Wisps */}
        <div aria-hidden="true" className="relative w-28 h-12 flex justify-center items-end space-x-4 mb-2 pointer-events-none">
          <svg className="w-3.5 h-9 text-[#B72E35]/60 stroke-current steam-wisp-1" fill="none" viewBox="0 0 20 50">
            <path d="M10 48C4 36 16 26 10 12C7 6 12 2 10 0" strokeLinecap="round" strokeWidth="2.5" />
          </svg>
          <svg className="w-4 h-11 text-[#B72E35]/75 stroke-current steam-wisp-2" fill="none" viewBox="0 0 20 50">
            <path d="M10 48C16 36 4 24 11 12C14 7 8 2 10 0" strokeLinecap="round" strokeWidth="3" />
          </svg>
          <svg className="w-3.5 h-8 text-[#B72E35]/50 stroke-current steam-wisp-3" fill="none" viewBox="0 0 20 50">
            <path d="M10 48C5 38 15 28 9 14C6 8 11 3 10 0" strokeLinecap="round" strokeWidth="2.5" />
          </svg>
        </div>

        {/* Interactive Bouncing Logo */}
        <div
          onClick={handleAccelerate}
          className={`relative group cursor-pointer transition-transform duration-200 ${
            tapScale ? "scale-95" : ""
          }`}
          title="Tap to feel the aroma & speed up"
        >
          <div className="animate-bouncy-logo select-none filter drop-shadow-md">
            <div className="relative w-44 sm:w-48 h-56 sm:h-60 mx-auto">
              <Image
                src="/icon-512.png"
                alt="Smol Café Logo"
                fill
                priority
                className="object-contain drop-shadow-sm transition-transform"
              />
            </div>
          </div>

          {/* Dynamic Ground Contact Shadow */}
          <div
            aria-hidden="true"
            className="mx-auto w-32 sm:w-36 h-3 sm:h-3.5 bg-[#2B2320]/30 dark:bg-black/50 rounded-full blur-[4px] animate-bouncy-shadow mt-1"
          />
        </div>

        {/* Sub-brand Tagline */}
        <div className="mt-8 text-center">
          <h1 className="font-serif italic font-bold text-2xl sm:text-3xl text-[#2B2320] dark:text-[#FAF4EB] tracking-wide lowercase">
            smol café
          </h1>
          <p className="text-[11px] sm:text-xs uppercase font-semibold tracking-[0.25em] text-[#B72E35] dark:text-[#FF6B6B] mt-1.5">
            cozy moments • handcrafted
          </p>
        </div>
      </section>

      {/* Bottom Progress Bar & Milestone Section */}
      <section className="relative z-10 px-6 sm:px-8 pb-8 sm:pb-10 flex flex-col items-center">
        <div className="w-full max-w-xs space-y-3">
          {/* Status Label & Percentage */}
          <div className="flex items-center justify-between text-xs text-[#2B2320]/80 dark:text-[#FAF4EB]/80 font-medium px-1">
            <span className="inline-flex items-center gap-1.5 transition-all duration-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  roundedPercent >= 100
                    ? "bg-emerald-500"
                    : "bg-[#B72E35] animate-ping"
                }`}
              />
              <span>{currentMilestone.message}</span>
            </span>
            <span className="font-mono font-semibold text-[#B72E35] dark:text-[#FF6B6B]">
              {roundedPercent}%
            </span>
          </div>

          {/* Shimmer Progress Track */}
          <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={roundedPercent}
            className="relative w-full h-2.5 bg-neutral-200/80 dark:bg-stone-800 rounded-full overflow-hidden p-0.5 shadow-inner border border-amber-900/10 dark:border-white/10"
            role="progressbar"
          >
            <div
              className="h-full rounded-full shimmer-active transition-all duration-200 ease-out shadow-xs"
              style={{ width: `${roundedPercent}%` }}
            />
          </div>

          {/* Subtitle / Storytelling text */}
          <p className="text-[11px] text-center text-[#8D7B75] dark:text-[#C9AE8B] transition-opacity duration-300">
            {currentMilestone.sub}
          </p>

          {/* Tap to enter / Fast forward button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={handleDismiss}
              type="button"
              className="group text-[11px] font-medium text-neutral-400 hover:text-[#B72E35] active:scale-95 transition-all flex items-center gap-1 py-1 px-3 rounded-full hover:bg-neutral-100/50 dark:hover:bg-white/5 cursor-pointer"
            >
              {roundedPercent >= 100 ? (
                <span className="text-[#B72E35] dark:text-[#FF6B6B] font-semibold animate-pulse">
                  Ready! Entering café... →
                </span>
              ) : (
                <span>Tap logo or click here to enter</span>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
