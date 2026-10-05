"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type {
  ProcurementData,
  EnrichedPO,
  POLineInput,
  GRNLineInput,
  IngredientStockItem,
} from "@/app/admin/procurement/actions";
import type { PurchaseOrderStatus } from "@smol-cafe/db";
import {
  createPurchaseOrderAction,
  recordGoodsReceiptAction,
  updatePurchaseOrderStatusAction,
  createVendorAction,
  fetchProcurementDataAction,
  quickRestockGRNAction,
  adjustIngredientStockAction,
  updateIngredientThresholdAction,
} from "@/app/admin/procurement/actions";
import {
  Send,
  PackageCheck,
  AlertTriangle,
  Flame,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Phone,
  Mail,
  Building2,
  TrendingDown,
  ArrowUpRight,
  PlusCircle,
  Sparkles,
  Search,
} from "lucide-react";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";

interface ProcurementManagerProps {
  initialData: ProcurementData;
  embedded?: boolean;
}

// Audio chime for successful GRN receipt
function playStockIngestSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // 2-tone pleasant rising chime (C5 -> G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.18);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
  } catch {
    // ignore
  }
}

export const ProcurementManager: React.FC<ProcurementManagerProps> = ({ initialData, embedded = false }) => {
  const [data, setData] = useState<ProcurementData>(initialData);
  const [activeTab, setActiveTab] = useState<"radar" | "pos" | "grns" | "vendors">("radar");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Quick Restock Modal State
  const [quickRestockItem, setQuickRestockItem] = useState<IngredientStockItem | null>(null);
  const [quickRestockQty, setQuickRestockQty] = useState<number>(10);
  const [quickRestockVendorId, setQuickRestockVendorId] = useState<string>("");
  const [quickRestockNotes, setQuickRestockNotes] = useState<string>("");
  const [isQuickRestocking, setIsQuickRestocking] = useState(false);

  // Adjust / Spoilage Modal State
  const [adjustItem, setAdjustItem] = useState<IngredientStockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(-1);
  const [adjustReason, setAdjustReason] = useState<"SPOILAGE" | "WASTE" | "SPILL" | "AUDIT_CORRECTION" | "PREP_CONSUMPTION">("SPOILAGE");
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Threshold Settings Modal State
  const [thresholdItem, setThresholdItem] = useState<IngredientStockItem | null>(null);
  const [thresholdVal, setThresholdVal] = useState<number>(5);
  const [unitCostVal, setUnitCostVal] = useState<number>(50);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);

  // New PO State
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poLines, setPoLines] = useState<POLineInput[]>([]);
  const [isCreatingPo, setIsCreatingPo] = useState(false);

  // Goods Receipt (GRN) Modal State
  const [activeReceivingPO, setActiveReceivingPO] = useState<EnrichedPO | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [grnNotes, setGrnNotes] = useState("");
  const [receivingLines, setReceivingLines] = useState<GRNLineInput[]>([]);
  const [isRecordingGrn, setIsRecordingGrn] = useState(false);

  // Add Vendor State
  const [vendorName, setVendorName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);

  const refreshData = React.useCallback(async () => {
    const fresh = await fetchProcurementDataAction();
    if (fresh.success) setData(fresh);
  }, []);

  // Listen to realtime INVENTORY_UPDATED and order events across all devices & tabs
  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((event) => {
      if (event.type === "INVENTORY_UPDATED") {
        const meta = event.metadata || {};
        const ingId = (meta.ingredientId as string) || event.itemId;
        const newStock = meta.newStock as number | undefined;

        if (ingId && typeof newStock === "number") {
          setData((prev) => {
            if (!prev.radarData) return prev;
            const updatedIngredients = prev.radarData.ingredients.map((ing) => {
              if (ing.id === ingId) {
                return {
                  ...ing,
                  currentStock: newStock,
                  status:
                    newStock <= 0
                      ? ("CRITICAL_LOW" as const)
                      : newStock <= ing.minThreshold
                      ? ("LOW_STOCK" as const)
                      : ("OPTIMAL" as const),
                };
              }
              return ing;
            });
            return {
              ...prev,
              radarData: {
                ...prev.radarData,
                ingredients: updatedIngredients,
                criticalCount: updatedIngredients.filter((i) => i.currentStock <= 0).length,
                lowStockCount: updatedIngredients.filter(
                  (i) => i.currentStock > 0 && i.currentStock <= i.minThreshold
                ).length,
                healthyCount: updatedIngredients.filter((i) => i.currentStock > i.minThreshold).length,
              },
            };
          });
        }
        refreshData();
      } else if (event.type === "ORDER_PLACED" || event.type === "ORDER_CONFIRMED") {
        refreshData();
      }
    });
    return () => unsubscribe();
  }, [refreshData]);

  // Fast fallback refresh when tab or network resumes
  useEffect(() => {
    const handleFocus = () => {
      refreshData();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, [refreshData]);

  // Quick Restock Submit
  const handleQuickRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRestockItem || quickRestockQty <= 0) return;

    setIsQuickRestocking(true);
    setFeedback(null);

    try {
      const vendor = data.vendors.find((v) => v.id === quickRestockVendorId);
      const res = await quickRestockGRNAction({
        ingredientId: quickRestockItem.id,
        quantity: quickRestockQty,
        unitCostPaise: quickRestockItem.costPerUnitPaise,
        vendorId: quickRestockVendorId || undefined,
        vendorName: vendor?.name || quickRestockItem.preferredVendorName,
        notes: quickRestockNotes.trim() || undefined,
      });

      if (res.success) {
        playStockIngestSound();
        setFeedback({ type: "success", text: res.message || `Restocked +${quickRestockQty} ${quickRestockItem.unitSymbol} successfully!` });

        // Optimistically update local radar data
        setData((prev) => {
          if (!prev.radarData) return prev;
          const updatedIngredients = prev.radarData.ingredients.map((ing) => {
            if (ing.id === quickRestockItem.id) {
              const newStock = Number((ing.currentStock + quickRestockQty).toFixed(1));
              return {
                ...ing,
                currentStock: newStock,
                status: (newStock <= ing.minThreshold * 0.4
                  ? "CRITICAL_LOW"
                  : newStock <= ing.minThreshold
                  ? "LOW_STOCK"
                  : "OPTIMAL") as IngredientStockItem["status"],
              };
            }
            return ing;
          });
          return {
            ...prev,
            radarData: {
              ...prev.radarData,
              ingredients: updatedIngredients,
            },
          };
        });

        const updatedStock = Number((quickRestockItem.currentStock + quickRestockQty).toFixed(1));
        setQuickRestockItem(null);
        await refreshData();
        broadcastSyncEvent({
          type: "INVENTORY_UPDATED",
          itemId: quickRestockItem.id,
          metadata: {
            ingredientId: quickRestockItem.id,
            newStock: updatedStock,
          },
        });
      } else {
        setFeedback({ type: "error", text: res.message || "Could not complete restock." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred during restock." });
    } finally {
      setIsQuickRestocking(false);
    }
  };

  // Stock Adjustment Submit
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || adjustQty === 0) return;

    setIsAdjusting(true);
    setFeedback(null);

    try {
      const res = await adjustIngredientStockAction({
        ingredientId: adjustItem.id,
        adjustmentQty: adjustQty,
        reason: adjustReason,
        notes: adjustNotes.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "Stock adjusted." });
        const adjustedItemId = adjustItem.id;
        setAdjustItem(null);
        await refreshData();
        broadcastSyncEvent({
          type: "INVENTORY_UPDATED",
          itemId: adjustedItemId,
          metadata: {
            ingredientId: adjustedItemId,
            newStock: res.newStock,
          },
        });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to adjust stock." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred during adjustment." });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Threshold update submit
  const handleThresholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholdItem) return;

    setIsUpdatingThreshold(true);
    setFeedback(null);

    try {
      const res = await updateIngredientThresholdAction({
        ingredientId: thresholdItem.id,
        minThreshold: thresholdVal,
        costPerUnitPaise: Math.round(unitCostVal * 100),
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "Threshold updated." });
        setThresholdItem(null);
        await refreshData();
        broadcastSyncEvent({ type: "INVENTORY_UPDATED" });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to update threshold." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  // Add Line to new PO
  const handleAddPoLine = () => {
    const defaultIng = (data.radarData?.ingredients && data.radarData.ingredients[0]) || { id: "ing-espresso", costPerUnitPaise: 180000 };
    setPoLines((prev) => [
      ...prev,
      {
        ingredientId: defaultIng.id,
        orderedQty: 10,
        unitCostPaise: defaultIng.costPerUnitPaise || 5000,
      },
    ]);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedVendorId) {
      setFeedback({ type: "error", text: "Please select a vendor." });
      return;
    }

    if (poLines.length === 0) {
      setFeedback({ type: "error", text: "Please add at least one line item." });
      return;
    }

    setIsCreatingPo(true);
    try {
      const res = await createPurchaseOrderAction({
        vendorId: selectedVendorId,
        expectedDeliveryDate: expectedDate || undefined,
        notes: poNotes,
        lines: poLines,
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "Purchase order created!" });
        setIsPoModalOpen(false);
        setPoLines([]);
        setPoNotes("");
        await refreshData();
      } else {
        setFeedback({ type: "error", text: res.message || "Could not create PO." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsCreatingPo(false);
    }
  };

  // Open Receive Modal for a PO
  const handleOpenReceiveModal = (po: EnrichedPO) => {
    setActiveReceivingPO(po);
    setInvoiceNo("");
    setGrnNotes("");
    setReceivingLines(
      po.lines.map((l) => ({
        poLineId: l.id,
        ingredientId: l.ingredient_id,
        receivedQty: Math.max(0, l.ordered_qty - l.received_qty),
        unitCostPaise: l.unit_cost_paise,
      }))
    );
  };

  const handleRecordGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReceivingPO) return;

    setIsRecordingGrn(true);
    setFeedback(null);

    try {
      const res = await recordGoodsReceiptAction({
        poId: activeReceivingPO.id,
        vendorId: activeReceivingPO.vendor_id,
        invoiceNo,
        notes: grnNotes,
        lines: receivingLines,
      });

      if (res.success) {
        playStockIngestSound();
        setFeedback({ type: "success", text: res.message || "Goods received and stock updated!" });
        setActiveReceivingPO(null);
        await refreshData();
        broadcastSyncEvent({ type: "INVENTORY_UPDATED" });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to record GRN." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsRecordingGrn(false);
    }
  };

  const handleStatusChange = async (poId: string, status: PurchaseOrderStatus) => {
    try {
      const res = await updatePurchaseOrderStatusAction(poId, status);
      if (res.success) {
        await refreshData();
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to update status." });
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingVendor(true);
    setFeedback(null);

    try {
      const res = await createVendorAction({
        name: vendorName,
        contactPerson,
        phone,
        email,
        taxId,
      });

      if (res.success) {
        setFeedback({ type: "success", text: "Vendor added successfully!" });
        setVendorName("");
        setContactPerson("");
        setPhone("");
        setEmail("");
        setTaxId("");
        await refreshData();
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to add vendor." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsCreatingVendor(false);
    }
  };

  const radar = data.radarData;
  const filteredIngredients = (radar?.ingredients || []).filter((item) => {
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.preferredVendorName && item.preferredVendorName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={`${embedded ? "w-full space-y-5" : "min-h-screen bg-[#F3E7D3] pb-28"} text-[#241F1C] dark:text-[#FDFBF7] transition-colors duration-200`}>
      {/* Top Header - Rendered only when not embedded in Admin Tower */}
      {!embedded && (
        <header className="sticky top-0 z-30 border-b border-[#C9AE8B]/40 bg-[#FAF4EB]/90 px-4 py-3.5 backdrop-blur-md dark:border-stone-800 dark:bg-[#1A1715]/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="rounded-full border border-[#C9AE8B]/50 bg-[#F3E7D3]/60 px-3 py-1.5 text-xs font-bold text-[#725039] transition hover:bg-[#EAE0CE] hover:text-[#241F1C] dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:text-white"
              >
                ← Admin Tower
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-serif font-bold tracking-tight text-[#B72E35] dark:text-[#F2C84B] flex items-center gap-2">
                    <Flame className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" /> Grocery &amp; Inventory Radar
                  </h1>
                  {radar && radar.criticalCount > 0 && (
                    <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-mono font-black text-[#B72E35] animate-pulse dark:bg-red-950/80 dark:text-red-300 border border-[#FCA5A5] dark:border-red-800">
                      {radar.criticalCount} CRITICAL
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B] hidden sm:block">
                  Real-Time Stock Radar • Goods Receipt Notes (GRN) • Direct Restock
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                title="Refresh inventory"
                className="p-2 rounded-full border border-[#C9AE8B]/50 bg-[#FAF4EB] text-[#725039] hover:bg-[#EAE0CE] active:scale-95 transition dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsPoModalOpen(true);
                  if (poLines.length === 0) {
                    handleAddPoLine();
                  }
                }}
                className="rounded-full bg-[#B72E35] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#9E242A] active:scale-95 dark:bg-[#B72E35] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> New PO
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Embedded Action Strip */}
      {embedded && (
        <div className="flex items-center justify-between bg-[#FAF4EB] p-3.5 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 dark:bg-[#1A1715]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-serif font-bold text-[#241F1C] dark:text-[#FDFBF7] flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
              Stock Radar &amp; Restock Control
            </h2>
            {radar && radar.criticalCount > 0 && (
              <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-mono font-black text-[#B72E35] animate-pulse dark:bg-red-950/80 dark:text-red-300 border border-[#FCA5A5] dark:border-red-800">
                {radar.criticalCount} CRITICAL
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              title="Refresh inventory"
              className="p-2 rounded-xl border border-[#C9AE8B]/50 bg-[#F3E7D3]/60 text-[#725039] hover:bg-[#EAE0CE] active:scale-95 transition dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setIsPoModalOpen(true);
                if (poLines.length === 0) {
                  handleAddPoLine();
                }
              }}
              className="rounded-xl bg-[#B72E35] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E242A] active:scale-95 dark:bg-[#B72E35] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> + New PO
            </button>
          </div>
        </div>
      )}

      <main className={embedded ? "space-y-5" : "mx-auto max-w-6xl px-4 pt-5 space-y-6"}>
        {/* Feedback notification */}
        {feedback && (
          <div
            className={`rounded-2xl p-3.5 text-xs font-bold flex items-center justify-between transition-all ${
              feedback.type === "error"
                ? "border border-red-300 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                : "border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}

        {/* Executive KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-3xl border border-red-300/80 bg-[#FAF4EB] p-4 shadow-sm dark:border-red-900/40 dark:bg-[#1A1715]">
            <div className="flex items-center justify-between text-[#B72E35] dark:text-red-400">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Critical Stock</span>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-serif font-black text-[#B72E35] dark:text-red-400 font-mono">
                {radar?.criticalCount || 0}
              </span>
              <span className="text-[11px] text-[#725039] dark:text-stone-400 font-medium">Need immediate restock</span>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-300/80 bg-[#FAF4EB] p-4 shadow-sm dark:border-amber-900/40 dark:bg-[#1A1715]">
            <div className="flex items-center justify-between text-[#B45309] dark:text-amber-400">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Low Stock Radar</span>
              <TrendingDown className="h-4 w-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-serif font-black text-[#B45309] dark:text-amber-400 font-mono">
                {radar?.lowStockCount || 0}
              </span>
              <span className="text-[11px] text-[#725039] dark:text-stone-400 font-medium">Below safety threshold</span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#C9AE8B]/40 bg-[#FAF4EB] p-4 shadow-sm dark:border-stone-800 dark:bg-[#1A1715]">
            <div className="flex items-center justify-between text-[#725039] dark:text-stone-400">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Stock Valuation</span>
              <Sparkles className="h-4 w-4 text-[#C9AE8B]" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-serif font-black text-[#241F1C] dark:text-[#FDFBF7] font-mono">
                ₹{Math.round((radar?.totalValuationPaise || 0) / 100).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#C9AE8B]/40 bg-[#FAF4EB] p-4 shadow-sm dark:border-stone-800 dark:bg-[#1A1715]">
            <div className="flex items-center justify-between text-[#725039] dark:text-stone-400">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Active Suppliers</span>
              <Building2 className="h-4 w-4 text-[#C9AE8B]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-serif font-black text-[#241F1C] dark:text-[#FDFBF7] font-mono">
                {data.vendors.length}
              </span>
              <span className="text-[11px] text-[#725039] dark:text-stone-400 font-medium">Verified partners</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-[#C9AE8B]/40 dark:border-stone-800 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("radar")}
            className={`px-4 py-2.5 text-xs font-bold transition rounded-t-xl border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "radar"
                ? "border-[#B72E35] text-[#B72E35] bg-[#FAF4EB] dark:bg-[#1A1715] dark:border-[#F2C84B] dark:text-[#F2C84B]"
                : "border-transparent text-[#725039] hover:text-[#241F1C] dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> Low-Stock Radar ({radar?.ingredients.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("pos")}
            className={`px-4 py-2.5 text-xs font-bold transition rounded-t-xl border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "pos"
                ? "border-[#B72E35] text-[#B72E35] bg-[#FAF4EB] dark:bg-[#1A1715] dark:border-[#F2C84B] dark:text-[#F2C84B]"
                : "border-transparent text-[#725039] hover:text-[#241F1C] dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            <Send className="h-3.5 w-3.5" /> Purchase Orders ({data.purchaseOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("grns")}
            className={`px-4 py-2.5 text-xs font-bold transition rounded-t-xl border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "grns"
                ? "border-[#B72E35] text-[#B72E35] bg-[#FAF4EB] dark:bg-[#1A1715] dark:border-[#F2C84B] dark:text-[#F2C84B]"
                : "border-transparent text-[#725039] hover:text-[#241F1C] dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            <PackageCheck className="h-3.5 w-3.5" /> Goods Receipts / GRN ({data.goodsReceipts.length})
          </button>
          <button
            onClick={() => setActiveTab("vendors")}
            className={`px-4 py-2.5 text-xs font-bold transition rounded-t-xl border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "vendors"
                ? "border-[#B72E35] text-[#B72E35] bg-[#FAF4EB] dark:bg-[#1A1715] dark:border-[#F2C84B] dark:text-[#F2C84B]"
                : "border-transparent text-[#725039] hover:text-[#241F1C] dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> Vendors Directory ({data.vendors.length})
          </button>
        </div>

        {/* TAB 1: LOW-STOCK RADAR & GROCERY BALANCES */}
        {activeTab === "radar" && (
          <div className="space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAF4EB] p-3 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 dark:bg-[#1A1715]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#725039] dark:text-stone-400" />
                <input
                  type="text"
                  placeholder="Search beans, dairy, produce, spices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F3E7D3]/60 rounded-xl border border-[#C9AE8B]/60 text-[#241F1C] focus:outline-none focus:border-[#B72E35] dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100 font-medium"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Items" },
                  { id: "COFFEE_BEANS", label: "☕ Coffee" },
                  { id: "DAIRY", label: "🥛 Dairy" },
                  { id: "BAKERY_RAW", label: "🍞 Bakery" },
                  { id: "PRODUCE", label: "🥑 Produce" },
                  { id: "SWEETENERS", label: "🍯 Syrups" },
                  { id: "SPICES_TEA", label: "🌿 Spices" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`whitespace-nowrap px-3 py-1 text-[11px] font-bold rounded-full transition cursor-pointer ${
                      categoryFilter === cat.id
                        ? "bg-[#B72E35] text-white shadow-xs"
                        : "bg-[#EAE0CE] text-[#725039] hover:bg-[#D9C5AB] dark:bg-stone-800 dark:text-stone-300"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Radar Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIngredients.map((item) => {
                const pct = Math.min(100, Math.round((item.currentStock / item.minThreshold) * 100));
                const isCritical = item.status === "CRITICAL_LOW";
                const isLow = item.status === "LOW_STOCK";

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-5 transition-all shadow-sm flex flex-col justify-between space-y-4 bg-[#FAF4EB] dark:bg-[#1A1715] ${
                      isCritical
                        ? "border-red-300 dark:border-red-900/60"
                        : isLow
                          ? "border-amber-300 dark:border-amber-900/40"
                          : "border-[#C9AE8B]/40 dark:border-stone-800"
                    }`}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 font-mono">
                            {item.category.replace("_", " ")}
                          </span>
                          <h3 className="text-base font-serif font-bold text-[#241F1C] dark:text-[#FDFBF7] leading-snug mt-0.5">
                            {item.name}
                          </h3>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase font-mono tracking-tight shrink-0 ${
                            isCritical
                              ? "bg-[#FEE2E2] text-[#B72E35] border border-[#FCA5A5] dark:bg-red-900/60 dark:text-red-300"
                              : isLow
                                ? "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] dark:bg-amber-900/60 dark:text-amber-300"
                                : item.status === "OVERSTOCKED"
                                  ? "bg-[#E0E7FF] text-[#3730A3] border border-[#C4B5FD] dark:bg-blue-900/40 dark:text-blue-300"
                                  : "bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                        >
                          {item.status === "CRITICAL_LOW" ? "CRITICAL LOW" : item.status.replace("_", " ")}
                        </span>
                      </div>

                      {item.preferredVendorName && (
                        <p className="text-[11px] text-[#725039] dark:text-[#C9AE8B] mt-1 flex items-center gap-1 font-medium">
                          <Building2 className="h-3 w-3 text-[#C9AE8B]" />
                          Supplier: <span className="font-semibold text-[#241F1C] dark:text-stone-300">{item.preferredVendorName}</span>
                        </p>
                      )}
                    </div>

                    {/* Stock Level Gauge */}
                    <div className="space-y-1.5 bg-[#EFE7DC] p-3 rounded-2xl dark:bg-[#120F0E] border border-[#C9AE8B]/20 dark:border-stone-800">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-xl font-black text-[#241F1C] dark:text-[#FDFBF7] font-mono">
                            {item.currentStock}
                          </span>
                          <span className="text-xs font-bold text-[#725039] dark:text-stone-400 ml-1">
                            {item.unitSymbol}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#725039] dark:text-stone-400 font-mono">
                          Safety Min: {item.minThreshold} {item.unitSymbol}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#D9C5AB]/60 dark:bg-stone-700">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCritical
                              ? "bg-[#B72E35] animate-pulse"
                              : isLow
                                ? "bg-[#F2C84B]"
                                : "bg-[#059669]"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#725039] dark:text-stone-400 font-mono pt-0.5">
                        <span>Burn: ~{item.burnRatePerDay} {item.unitSymbol}/day</span>
                        <span>₹{Math.round(item.costPerUnitPaise / 100)}/{item.unitSymbol}</span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* 1-Tap Quick Restock */}
                      <button
                        onClick={() => {
                          setQuickRestockItem(item);
                          setQuickRestockQty(Math.max(5, item.suggestedRestockQty || 10));
                          setQuickRestockNotes("");
                          const pref = data.vendors.find((v) => v.name === item.preferredVendorName);
                          setQuickRestockVendorId(pref ? pref.id : (data.vendors[0]?.id || ""));
                        }}
                        className="flex-1 rounded-xl bg-[#B72E35] px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E242A] active:scale-95 flex items-center justify-center gap-1 dark:bg-[#B72E35] cursor-pointer"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> Quick Restock
                      </button>

                      {/* Log Spoilage / Adjust */}
                      <button
                        onClick={() => {
                          setAdjustItem(item);
                          setAdjustQty(-1);
                          setAdjustReason("SPOILAGE");
                          setAdjustNotes("");
                        }}
                        title="Log Spoilage / Audit Adjustment"
                        className="p-2 rounded-xl border border-[#C9AE8B]/50 bg-[#F3E7D3]/60 text-[#725039] hover:bg-[#EAE0CE] active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 cursor-pointer"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>

                      {/* Threshold & Cost settings */}
                      <button
                        onClick={() => {
                          setThresholdItem(item);
                          setThresholdVal(item.minThreshold);
                          setUnitCostVal(item.costPerUnitPaise / 100);
                        }}
                        title="Configure Safety Thresholds"
                        className="p-2 rounded-xl border border-[#C9AE8B]/50 bg-[#F3E7D3]/60 text-[#725039] hover:bg-[#EAE0CE] active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 cursor-pointer"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PURCHASE ORDERS */}
        {activeTab === "pos" && (
          <div className="space-y-4">
            {data.purchaseOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#C9AE8B] bg-[#FAF4EB] p-12 text-center text-xs text-[#725039] dark:border-stone-800 dark:bg-[#1A1715] dark:text-stone-400">
                No purchase orders created yet. Tap &ldquo;+ Create Purchase Order&rdquo; to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {data.purchaseOrders.map((po) => (
                  <div
                    key={po.id}
                    className="rounded-3xl border border-[#C9AE8B]/40 bg-[#FAF4EB] p-5 shadow-sm dark:border-stone-800 dark:bg-[#1A1715] space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#241F1C] dark:text-[#FDFBF7]">
                            {po.po_number}
                          </span>
                          <span className="text-[#C9AE8B]">•</span>
                          <span className="text-xs font-bold text-[#725039] dark:text-[#C9AE8B]">
                            {po.vendor_name}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#725039] dark:text-stone-400 font-mono mt-0.5">
                          Created{" "}
                          {new Date(po.created_at).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                          {po.expected_delivery_date && ` • Expected ${po.expected_delivery_date}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase font-mono ${
                            po.status === "RECEIVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                              : po.status === "PARTIALLY_RECEIVED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300"
                                : po.status === "SENT"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300"
                                  : "bg-[#EAE0CE] text-[#725039] dark:bg-stone-800 dark:text-stone-300"
                          }`}
                        >
                          {po.status}
                        </span>

                        <span className="font-mono text-xs font-black text-[#241F1C] dark:text-[#FDFBF7]">
                          ₹{Math.round(po.total_amount_paise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Lines List */}
                    <div className="rounded-2xl border border-[#C9AE8B]/30 bg-[#EFE7DC]/60 p-3 dark:border-stone-800 dark:bg-stone-800/40 divide-y divide-[#C9AE8B]/20 dark:divide-stone-800">
                      {po.lines.map((line) => (
                        <div
                          key={line.id}
                          className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs font-mono"
                        >
                          <span className="text-[#241F1C] dark:text-[#FDFBF7] font-medium">
                            {line.ingredient_name}
                          </span>
                          <span className="text-[#725039] dark:text-stone-400">
                            Ordered: {line.ordered_qty} {line.unit_symbol} • Recv:{" "}
                            {line.received_qty} {line.unit_symbol} (₹
                            {Math.round(line.line_total_paise / 100)})
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex gap-2">
                        {po.status === "DRAFT" && (
                          <button
                            onClick={() => handleStatusChange(po.id, "SENT")}
                            className="rounded-xl border border-[#C9AE8B]/50 bg-[#F3E7D3] px-3 py-1.5 font-bold text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:bg-stone-800 flex items-center gap-1.5 cursor-pointer"
                          >
                            Mark as Sent <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {po.status !== "RECEIVED" && po.status !== "CLOSED" && (
                        <button
                          onClick={() => handleOpenReceiveModal(po)}
                          className="rounded-xl bg-[#B72E35] px-4 py-1.5 font-bold text-white shadow-xs hover:bg-[#9E242A] active:scale-95 dark:bg-[#B72E35] flex items-center gap-1.5 cursor-pointer"
                        >
                          <PackageCheck className="h-4 w-4" /> Record Delivery (GRN)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GOODS RECEIPTS (GRN) */}
        {activeTab === "grns" && (
          <div className="space-y-3">
            {data.goodsReceipts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#C9AE8B] bg-[#FAF4EB] p-12 text-center text-xs text-[#725039] dark:border-stone-800 dark:bg-[#1A1715] dark:text-stone-400">
                No deliveries recorded yet.
              </div>
            ) : (
              data.goodsReceipts.map((grn) => (
                <div
                  key={grn.id}
                  className="rounded-3xl border border-[#C9AE8B]/40 bg-[#FAF4EB] p-5 shadow-sm dark:border-stone-800 dark:bg-[#1A1715] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-[#059669] dark:text-emerald-400">
                          {grn.grn_number}
                        </span>
                        <span className="text-[#C9AE8B]">•</span>
                        <span className="text-xs font-bold text-[#241F1C] dark:text-[#FDFBF7]">
                          {grn.vendor_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#725039] dark:text-stone-400 font-mono mt-0.5">
                        Received{" "}
                        {new Date(grn.received_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {grn.invoice_no && ` • Invoice: ${grn.invoice_no}`}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono">
                      ✓ Stock Ingested
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#C9AE8B]/30 bg-[#EFE7DC]/60 p-3 dark:border-stone-800 dark:bg-stone-800/40 space-y-1">
                    {grn.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-[#241F1C] dark:text-[#FDFBF7] font-bold">
                          + {line.received_qty} {line.ingredient_name}
                        </span>
                        <span className="text-[#725039] dark:text-stone-400">
                          @ ₹{Math.round(line.unit_cost_paise / 100)} / unit
                        </span>
                      </div>
                    ))}
                  </div>

                  {grn.notes && (
                    <p className="text-[11px] text-[#725039] dark:text-stone-400 italic bg-[#EAE0CE]/50 p-2 rounded-xl dark:bg-stone-800/30 font-mono">
                      Note: {grn.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: VENDORS DIRECTORY */}
        {activeTab === "vendors" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="rounded-3xl border border-[#C9AE8B]/40 bg-[#FAF4EB] p-5 shadow-sm dark:border-stone-800 dark:bg-[#1A1715] space-y-4">
                <h3 className="text-base font-serif font-bold text-[#241F1C] dark:text-[#FDFBF7]">
                  Add New Vendor
                </h3>
                <form onSubmit={handleCreateVendor} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                      Vendor / Company Name
                    </label>
                    <input
                      type="text"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="e.g. Valley Organic Dairies"
                      required
                      className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:border-[#B72E35] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Rajesh"
                      className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:border-[#B72E35] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98..."
                      className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:border-[#B72E35] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                      GSTIN / Tax ID
                    </label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="02AAAAA..."
                      className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:border-[#B72E35] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingVendor || !vendorName.trim()}
                    className="w-full rounded-2xl bg-[#B72E35] py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E242A] disabled:opacity-50 dark:bg-[#B72E35] cursor-pointer"
                  >
                    {isCreatingVendor ? "Adding..." : "+ Add Vendor"}
                  </button>
                </form>
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              {data.vendors.map((v) => (
                <div
                  key={v.id}
                  className="rounded-3xl border border-[#C9AE8B]/40 bg-[#FAF4EB] p-5 shadow-sm dark:border-stone-800 dark:bg-[#1A1715] space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-serif font-bold text-[#241F1C] dark:text-[#FDFBF7]">
                        {v.name}
                      </h4>
                      <p className="text-xs text-[#725039] dark:text-[#C9AE8B]">
                        {v.contact_person ? `${v.contact_person} • ` : ""}
                        {v.phone || "No phone"}
                      </p>
                    </div>
                    {v.tax_id && (
                      <span className="font-mono text-[10px] text-[#725039] bg-[#EAE0CE] px-2 py-0.5 rounded-lg dark:bg-stone-800 dark:text-stone-300">
                        GSTIN: {v.tax_id}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#725039] dark:text-[#C9AE8B] pt-1">
                    {v.phone && (
                      <a href={`tel:${v.phone}`} className="flex items-center gap-1 hover:text-[#B72E35]">
                        <Phone className="h-3 w-3" /> {v.phone}
                      </a>
                    )}
                    {v.email && (
                      <a href={`mailto:${v.email}`} className="flex items-center gap-1 hover:text-[#B72E35]">
                        <Mail className="h-3 w-3" /> {v.email}
                      </a>
                    )}
                  </div>

                  {v.notes && (
                    <p className="text-xs text-[#725039] dark:text-stone-400 bg-[#EFE7DC] p-2.5 rounded-xl dark:bg-stone-800/40 font-mono">
                      {v.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: 1-TAP QUICK RESTOCK (GRN) */}
      {quickRestockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-6 shadow-2xl dark:border-stone-800 dark:bg-[#1A1715] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-black text-[#241F1C] dark:text-[#FDFBF7] flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-emerald-600" /> 1-Tap Quick Restock
                </h3>
                <p className="text-xs text-[#725039] dark:text-[#C9AE8B] font-mono">
                  {quickRestockItem.name}
                </p>
              </div>
              <button
                onClick={() => setQuickRestockItem(null)}
                className="text-[#725039] hover:text-[#241F1C] dark:text-stone-400 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickRestockSubmit} className="space-y-4">
              <div className="bg-[#EFE7DC] p-3.5 rounded-2xl dark:bg-[#120F0E] flex items-center justify-between border border-[#C9AE8B]/30 dark:border-stone-800">
                <div>
                  <span className="text-[10px] text-[#725039] dark:text-stone-400 uppercase font-mono font-bold">Current Stock</span>
                  <p className="text-base font-black text-[#241F1C] dark:text-[#FDFBF7] font-mono">
                    {quickRestockItem.currentStock} {quickRestockItem.unitSymbol}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#725039] dark:text-stone-400 uppercase font-mono font-bold">After Restock</span>
                  <p className="text-base font-black text-[#059669] dark:text-emerald-400 font-mono">
                    {(quickRestockItem.currentStock + quickRestockQty).toFixed(1)} {quickRestockItem.unitSymbol}
                  </p>
                </div>
              </div>

              {/* Quantity quick buttons */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400">
                  Restock Quantity ({quickRestockItem.unitSymbol})
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 20, 50].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuickRestockQty(qty)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        quickRestockQty === qty
                          ? "border-[#B72E35] bg-[#B72E35] text-white shadow-xs"
                          : "border-[#C9AE8B]/50 bg-[#F3E7D3]/60 text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                      }`}
                    >
                      +{qty}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={quickRestockQty}
                  onChange={(e) => setQuickRestockQty(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] font-mono focus:outline-none focus:border-[#B72E35] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              {/* Vendor Selector */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Supplier / Vendor
                </label>
                <select
                  value={quickRestockVendorId}
                  onChange={(e) => setQuickRestockVendorId(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-medium"
                >
                  <option value="">{quickRestockItem.preferredVendorName || "Select Supplier..."}</option>
                  {data.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Delivery / Batch Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh morning milk batch / Invoice #904"
                  value={quickRestockNotes}
                  onChange={(e) => setQuickRestockNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isQuickRestocking || quickRestockQty <= 0}
                  className="flex-1 rounded-2xl bg-[#059669] py-3 text-xs font-bold text-white shadow hover:bg-[#047857] disabled:opacity-50 cursor-pointer"
                >
                  {isQuickRestocking ? "Receiving Stock..." : `Confirm Restock (+${quickRestockQty} ${quickRestockItem.unitSymbol}) →`}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRestockItem(null)}
                  className="rounded-2xl border border-[#C9AE8B]/50 px-4 py-3 text-xs font-bold text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST STOCK / SPOILAGE */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-6 shadow-2xl dark:border-stone-800 dark:bg-[#1A1715] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-black text-[#241F1C] dark:text-[#FDFBF7] flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-amber-600" /> Adjust Stock / Log Spoilage
                </h3>
                <p className="text-xs text-[#725039] dark:text-[#C9AE8B] font-mono">
                  {adjustItem.name}
                </p>
              </div>
              <button
                onClick={() => setAdjustItem(null)}
                className="text-[#725039] hover:text-[#241F1C] dark:text-stone-400 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Reason for Adjustment
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as typeof adjustReason)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-medium"
                >
                  <option value="SPOILAGE">Spoilage / Expired</option>
                  <option value="WASTE">Kitchen Prep Waste</option>
                  <option value="SPILL">Accidental Spill / Damage</option>
                  <option value="AUDIT_CORRECTION">Physical Count Audit Correction</option>
                  <option value="PREP_CONSUMPTION">Unlogged Prep Consumption</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Adjustment Quantity (Negative to reduce, Positive to add)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] font-mono focus:outline-none focus:border-[#B72E35] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
                <p className="text-[11px] text-[#725039] dark:text-stone-400 mt-1 font-mono">
                  Current: {adjustItem.currentStock} {adjustItem.unitSymbol} → New: {Math.max(0, adjustItem.currentStock + adjustQty).toFixed(1)} {adjustItem.unitSymbol}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milk expired after evening shift / dropped carton"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isAdjusting || adjustQty === 0}
                  className="flex-1 rounded-2xl bg-[#D97706] py-3 text-xs font-bold text-white shadow hover:bg-[#B45309] disabled:opacity-50 cursor-pointer"
                >
                  {isAdjusting ? "Adjusting..." : "Apply Stock Adjustment"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="rounded-2xl border border-[#C9AE8B]/50 px-4 py-3 text-xs font-bold text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIGURE THRESHOLD & UNIT COST */}
      {thresholdItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-6 shadow-2xl dark:border-stone-800 dark:bg-[#1A1715] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-black text-[#241F1C] dark:text-[#FDFBF7]">
                  Threshold &amp; Cost Settings
                </h3>
                <p className="text-xs text-[#725039] dark:text-[#C9AE8B] font-mono">
                  {thresholdItem.name}
                </p>
              </div>
              <button
                onClick={() => setThresholdItem(null)}
                className="text-[#725039] hover:text-[#241F1C] dark:text-stone-400 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleThresholdSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Safety Minimum Alert Threshold ({thresholdItem.unitSymbol})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={thresholdVal}
                  onChange={(e) => setThresholdVal(parseFloat(e.target.value) || 1)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] font-mono dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
                <p className="text-[10px] text-[#725039] dark:text-stone-400 mt-1">
                  Radar triggers an alert when stock drops below this level.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Standard Cost per {thresholdItem.unitSymbol} (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={unitCostVal}
                  onChange={(e) => setUnitCostVal(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] font-mono dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingThreshold}
                  className="flex-1 rounded-2xl bg-[#B72E35] py-3 text-xs font-bold text-white shadow hover:bg-[#9E242A] disabled:opacity-50 dark:bg-[#B72E35] cursor-pointer"
                >
                  {isUpdatingThreshold ? "Saving..." : "Save Settings"}
                </button>
                <button
                  type="button"
                  onClick={() => setThresholdItem(null)}
                  className="rounded-2xl border border-[#C9AE8B]/50 px-4 py-3 text-xs font-bold text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE PURCHASE ORDER */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-6 shadow-2xl dark:border-stone-800 dark:bg-[#1A1715] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-[#241F1C] dark:text-[#FDFBF7]">
                New Purchase Order
              </h3>
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="text-[#725039] hover:text-[#241F1C] dark:text-stone-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Vendor
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-medium"
                >
                  <option value="">Select a vendor...</option>
                  {data.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Expected Delivery Date (Optional)
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                />
              </div>

              {/* PO Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400">
                    Order Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPoLine}
                    className="text-xs font-bold text-[#B72E35] hover:underline cursor-pointer"
                  >
                    + Add Item
                  </button>
                </div>

                {poLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-[#EFE7DC] p-2.5 rounded-2xl dark:bg-stone-800/60 border border-[#C9AE8B]/20"
                  >
                    <div className="col-span-5">
                      <select
                        value={line.ingredientId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, ingredientId: val } : l))
                          );
                        }}
                        className="w-full rounded-lg border border-[#C9AE8B]/50 bg-[#FAF4EB] px-2 py-1.5 text-xs text-[#241F1C] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 font-medium"
                      >
                        {(radar?.ingredients || []).map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={line.orderedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPoLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, orderedQty: val } : l))
                          );
                        }}
                        className="w-full rounded-lg border border-[#C9AE8B]/50 bg-[#FAF4EB] px-2 py-1.5 text-xs text-[#241F1C] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 font-mono"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="₹ Unit"
                        value={line.unitCostPaise / 100}
                        onChange={(e) => {
                          const val = Math.round((parseFloat(e.target.value) || 0) * 100);
                          setPoLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, unitCostPaise: val } : l))
                          );
                        }}
                        className="w-full rounded-lg border border-[#C9AE8B]/50 bg-[#FAF4EB] px-2 py-1.5 text-xs text-[#241F1C] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 font-mono"
                      />
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => setPoLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[#725039] hover:text-red-600 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingPo || poLines.length === 0}
                  className="flex-1 rounded-2xl bg-[#B72E35] py-3 text-xs font-bold text-white shadow hover:bg-[#9E242A] disabled:opacity-50 dark:bg-[#B72E35] cursor-pointer"
                >
                  {isCreatingPo ? "Creating..." : "Save Purchase Order"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="rounded-2xl border border-[#C9AE8B]/50 px-5 py-3 text-xs font-bold text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RECORD GOODS RECEIPT (GRN) */}
      {activeReceivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-6 shadow-2xl dark:border-stone-800 dark:bg-[#1A1715] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#241F1C] dark:text-[#FDFBF7]">
                  Record Goods Receipt (GRN)
                </h3>
                <p className="text-xs text-[#725039] dark:text-[#C9AE8B] font-mono">
                  Against {activeReceivingPO.po_number} • {activeReceivingPO.vendor_name}
                </p>
              </div>
              <button
                onClick={() => setActiveReceivingPO(null)}
                className="text-[#725039] hover:text-[#241F1C] dark:text-stone-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordGRN} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400 mb-1">
                  Vendor Invoice / Bill No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-9021"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/60 bg-[#F3E7D3]/50 px-3 py-2 text-xs text-[#241F1C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              {/* Receiving Line Quantities */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#725039] dark:text-stone-400">
                  Received Quantities (Will increase stock)
                </label>

                {receivingLines.map((line, idx) => {
                  const poLine = activeReceivingPO.lines.find((l) => l.id === line.poLineId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#EFE7DC] p-3 rounded-2xl dark:bg-stone-800/60 border border-[#C9AE8B]/20"
                    >
                      <div>
                        <span className="text-xs font-bold text-[#241F1C] dark:text-[#FDFBF7]">
                          {poLine?.ingredient_name || "Ingredient"}
                        </span>
                        <p className="text-[10px] text-[#725039] dark:text-stone-400 font-mono">
                          Ordered: {poLine?.ordered_qty} {poLine?.unit_symbol}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#725039] font-bold">Recv:</span>
                        <input
                          type="number"
                          step="0.01"
                          value={line.receivedQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceivingLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, receivedQty: val } : l))
                            );
                          }}
                          className="w-24 rounded-lg border border-[#C9AE8B]/50 bg-[#FAF4EB] px-2 py-1 text-xs text-[#241F1C] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 font-mono"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isRecordingGrn}
                  className="flex-1 rounded-2xl bg-[#059669] py-3 text-xs font-bold text-white shadow hover:bg-[#047857] disabled:opacity-50 cursor-pointer"
                >
                  {isRecordingGrn ? "Ingesting Stock..." : "Confirm Delivery & Ingest Stock →"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReceivingPO(null)}
                  className="rounded-2xl border border-[#C9AE8B]/50 px-5 py-3 text-xs font-bold text-[#725039] hover:bg-[#EAE0CE] dark:border-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
