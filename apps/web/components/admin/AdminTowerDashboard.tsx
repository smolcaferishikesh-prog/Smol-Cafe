"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  CreditCard,
  Armchair,
  ShoppingBag,
  Users,
  Settings,
  Shield,
  Tag,
  Search,
  QrCode,
  Coffee,
  RefreshCw,
  ExternalLink,
  Gift,
  TrendingUp,
  Menu,
  X,
  Receipt,
  Key,
  Lock,
  Eye,
  EyeOff,
  Check,
  Edit2,
  RotateCcw,
  ChefHat,
  Zap,
  Sparkles,
  Award,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  Flame,
  Boxes,
  PackagePlus,
  Download,
  Printer,
  Phone,
  MapPin,
  Store,
  Building2,
  UserPlus,
  HeartHandshake,
  FileSpreadsheet,
} from "lucide-react";
import { downloadCsv } from "@/lib/export-utils";
import { DigitalReceiptModal, type ReceiptData } from "@/components/payment/DigitalReceiptModal";
import { ProcurementManager } from "@/components/admin/ProcurementManager";
import {
  fetchProcurementDataAction,
  type ProcurementData,
} from "@/app/admin/procurement/actions";
import {
  getLoyaltyConfigAction,
  updateLoyaltyConfigAction,
  fetchLoyaltyMembersAction,
  grantLoyaltyPointsManualAction,
} from "@/app/account/loyalty-actions";
import {
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfig,
  type LoyaltyMemberItem,
  type LoyaltyBonusRule,
} from "@/lib/loyalty/config";
import { TABLE_ZONES_CONFIG, createTableJsonTag, type TableJsonTag } from "@/lib/table-tag";
import { getUpiConfig, updateMerchantConfig, type MerchantConfig } from "@/lib/upi";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";
import { JsonTagInspectorModal } from "@/components/table/JsonTagInspectorModal";
import { OrderDetailsInspectorModal } from "@/components/admin/OrderDetailsInspectorModal";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { TableManager } from "@/components/admin/TableManager";
import { AdminMenuManager } from "@/components/admin/AdminMenuManager";
import {
  fetchAdminOverviewAction,
  updateAdminOrderStatusAction,
  type AdminOverviewData,
  type AdminOrderRecord,
  type AdminPaymentRecord,
} from "@/app/admin/actions";
import {
  getRoleCredentialsAction,
  updateRoleCredentialAction,
  resetRoleCredentialAction,
  type RoleCredentialsMap,
  type RoleCredential,
} from "@/app/smol-backdoor/actions";
import type { OrderStatus } from "@smol-cafe/db";

interface AdminTowerProps {
  initialMetrics?: {
    activeTablesCount?: number;
    activeOrdersCount?: number;
    lowStockCount?: number;
  };
  initialOverviewData?: AdminOverviewData;
}

export const AdminTowerDashboard: React.FC<AdminTowerProps> = ({ initialOverviewData }) => {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "orders"
    | "tables"
    | "menu"
    | "inventory"
    | "customers"
    | "staff"
    | "payments"
    | "rewards"
    | "analytics"
    | "settings"
  >("overview");

  const [inspectingTag, setInspectingTag] = useState<TableJsonTag | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<AdminOrderRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live overview dataset
  const [overviewData, setOverviewData] = useState<AdminOverviewData | null>(initialOverviewData || null);
  const [orders, setOrders] = useState<AdminOrderRecord[]>(initialOverviewData?.orders || []);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>(initialOverviewData?.payments || []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Procurement & Inventory State
  const [procurementData, setProcurementData] = useState<ProcurementData>({
    success: true,
    vendors: [],
    ingredients: [],
    purchaseOrders: [],
    goodsReceipts: [],
  });

  useEffect(() => {
    fetchProcurementDataAction().then((res) => {
      if (res.success) setProcurementData(res);
    }).catch(console.error);
  }, []);

  // Merchant Settings State
  const [merchantConfig, setMerchantConfig] = useState<MerchantConfig>(getUpiConfig());
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Role Credentials State (RBAC Quick PINs)
  const [roleCredentials, setRoleCredentials] = useState<RoleCredentialsMap>({
    admin: {
      role: "admin",
      roleName: "Super Admin (Owner)",
      portal: "/admin",
      pin: "9900",
      password: "smol2026",
      permissions: "Full Control, Budgets, Logs",
      status: "Active",
    },
    cashier: {
      role: "cashier",
      roleName: "Cashier / Counter Staff",
      portal: "/cashier",
      pin: "4422",
      permissions: "Order Verification, Cash Settlement",
      status: "Active",
    },
    kitchen: {
      role: "kitchen",
      roleName: "Kitchen Display (Chef/Cooks)",
      portal: "/kitchen",
      pin: "7711",
      permissions: "Order Queue, Food Prep Status",
      status: "Active",
    },
    barista: {
      role: "barista",
      roleName: "Barista Desk (Espresso & Brew)",
      portal: "/smol-backdoor/barista",
      pin: "1234",
      permissions: "Beverage Queue, Shot Timer, Brew Status",
      status: "Active",
    },
  });

  const [editingRole, setEditingRole] = useState<RoleCredential | null>(null);
  const [editPinValue, setEditPinValue] = useState("");
  const [editPasswordValue, setEditPasswordValue] = useState("");
  const [showPinMask, setShowPinMask] = useState(false);
  const [pinUpdating, setPinUpdating] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getRoleCredentialsAction(true)
      .then((res) => {
        if (res.success && res.credentials) {
          setRoleCredentials(res.credentials);
        }
      })
      .catch(console.error);
  }, []);

  const handleOpenEditPin = (roleCred: RoleCredential) => {
    setEditingRole(roleCred);
    setEditPinValue(roleCred.pin === "****" ? "" : roleCred.pin);
    setEditPasswordValue(roleCred.password || "");
    setShowPinMask(true);
    setPinFeedback(null);
  };

  const handleSaveRolePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setPinUpdating(true);
    setPinFeedback(null);

    try {
      const res = await updateRoleCredentialAction(
        editingRole.role,
        editPinValue,
        editingRole.role === "admin" ? editPasswordValue : undefined
      );

      if (res.success && res.credentials) {
        setRoleCredentials(res.credentials);
        setPinFeedback({ type: "success", text: res.message });
        setEditingRole(null);
      } else {
        setPinFeedback({ type: "error", text: res.message || "Failed to update PIN." });
      }
    } catch {
      setPinFeedback({ type: "error", text: "An error occurred while updating PIN." });
    } finally {
      setPinUpdating(false);
    }
  };

  const handleResetRolePin = async (role: "admin" | "cashier" | "kitchen" | "barista") => {
    setPinUpdating(true);
    try {
      const res = await resetRoleCredentialAction(role);
      if (res.success && res.credentials) {
        setRoleCredentials(res.credentials);
        setEditPinValue(res.credentials[role].pin);
        setEditPasswordValue(res.credentials[role].password || "");
        setPinFeedback({ type: "success", text: res.message });
      }
    } catch {
      setPinFeedback({ type: "error", text: "Failed to reset PIN." });
    } finally {
      setPinUpdating(false);
    }
  };

  // Loyalty & Rewards State
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>(DEFAULT_LOYALTY_CONFIG);
  const [loyaltyMembers, setLoyaltyMembers] = useState<LoyaltyMemberItem[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltySaveNotice, setLoyaltySaveNotice] = useState<string | null>(null);
  const [adjustPointsModal, setAdjustPointsModal] = useState<{
    member: LoyaltyMemberItem;
    pointsDelta: number;
    reason: string;
  } | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [bonusRulesEdit, setBonusRulesEdit] = useState<LoyaltyBonusRule[]>(DEFAULT_LOYALTY_CONFIG.bonusRules);

  // Customer CRM & Search
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerTierFilter, setCustomerTierFilter] = useState("ALL");

  // Digital Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Rewards Approval Queue State
  const [rewardApprovalRequests, setRewardApprovalRequests] = useState<Array<{
    id: string;
    customerName: string;
    phone: string;
    rewardName: string;
    pointsCost: number;
    requestedAt: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
  }>>([
    { id: "REQ-101", customerName: "Aarav Sharma", phone: "+91 9876543210", rewardName: "Complimentary Flat White", pointsCost: 80, requestedAt: "10 mins ago", status: "PENDING" },
    { id: "REQ-102", customerName: "Meera Sen", phone: "+91 9811223344", rewardName: "15% Off Sourdough Melts", pointsCost: 120, requestedAt: "25 mins ago", status: "PENDING" },
    { id: "REQ-103", customerName: "Devendra Negi", phone: "+91 9412000000", rewardName: "Artisanal Cold Brew Bottle", pointsCost: 150, requestedAt: "1 hour ago", status: "PENDING" },
  ]);

  const handleApproveReward = (requestId: string) => {
    setRewardApprovalRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "APPROVED" } : r))
    );
    setLoyaltySaveNotice(`Reward request ${requestId} approved!`);
    broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
    setTimeout(() => setLoyaltySaveNotice(null), 3500);
  };

  const handleRejectReward = (requestId: string) => {
    const req = rewardApprovalRequests.find((r) => r.id === requestId);
    if (req) {
      // Return points to customer balance
      setLoyaltyMembers((prev) =>
        prev.map((m) =>
          m.displayName === req.customerName || m.phone === req.phone
            ? { ...m, currentBalance: m.currentBalance + req.pointsCost }
            : m
        )
      );
    }
    setRewardApprovalRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "REJECTED" } : r))
    );
    setLoyaltySaveNotice(`Reward request ${requestId} rejected — ${req?.pointsCost || 0} pts refunded to customer!`);
    broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
    setTimeout(() => setLoyaltySaveNotice(null), 3500);
  };

  // CSV Export Handlers
  const handleExportOverview = () => {
    const headers = ["Order No", "Table", "Total (INR)", "Status", "Payment Method", "Payment Status", "Created At", "Line Items"];
    const rows = orders.map((o) => [
      `#${o.orderNo || o.id.slice(0, 6)}`,
      `Table ${o.tableLabel} (${o.zone})`,
      o.totalRupees,
      o.status,
      o.paymentMethod || "UPI",
      o.paymentStatus || "PAID",
      o.createdAt || o.rawCreatedAt,
      o.items.join(" | "),
    ]);
    downloadCsv("smol_cafe_orders_ledger", headers, rows);
  };

  const handleExportPayments = () => {
    const headers = ["Transaction ID", "Payment Method", "Amount", "Order Reference", "Settlement Status", "Time"];
    const rows = payments.map((p) => [
      p.txn,
      p.mode,
      p.amt,
      p.ord,
      p.st,
      p.time || "Today",
    ]);
    downloadCsv("smol_cafe_payments_reconciliation", headers, rows);
  };

  const handleExportCustomers = () => {
    const headers = ["Customer Name", "Phone", "Loyalty Tier", "Current Points Balance", "Total Earned Points", "Dining Spend (INR)", "Visit Count"];
    const rows = loyaltyMembers.map((m) => [
      m.displayName,
      m.phone,
      m.tier,
      m.currentBalance,
      m.totalEarned,
      m.totalSpentRupees,
      m.visitCount,
    ]);
    downloadCsv("smol_cafe_customers_crm", headers, rows);
  };

  const handleExportAnalytics = () => {
    const headers = ["Metric", "Value", "Notes"];
    const rows = [
      ["Gross Revenue Today", `₹${overviewData?.kpis.grossRevenueRupees ?? 0}`, "Gross settled total"],
      ["Total Completed Orders", overviewData?.kpis.todaysOrders ?? 0, "Daily orders count"],
      ["Average Order Value", `₹${overviewData?.kpis.avgOrderRupees ?? 0}`, "Average ticket size"],
      ["Top Selling Item", `${overviewData?.kpis.topSellerName ?? "Espresso"} (${overviewData?.kpis.topSellerUnits ?? 0} units)`, "Highest velocity item"],
      ["Active Tables", `${overviewData?.kpis.activeTablesCount ?? 0} of ${overviewData?.kpis.totalTablesCount ?? 0}`, "Floor occupancy"],
      ["Average Table Turnaround", "42 mins", "Dwell time per party"],
      ["Customer Reorder Rate", "28%", "Multi-round dining rate"],
    ];
    downloadCsv("smol_cafe_executive_analytics", headers, rows);
  };

  const handleViewReceipt = (t: { txn: string; mode: string; amt: string; ord: string; st: string; time?: string }) => {
    const numericTotal = parseFloat(t.amt.replace(/[^0-9.]/g, "")) || 0;
    const subtotal = Math.round((numericTotal / 1.05) * 100) / 100;
    const tax = Math.round((numericTotal - subtotal) * 100) / 100;

    const matchedOrder = orders.find(
      (o) => (o.orderNo && t.ord.includes(String(o.orderNo))) || (o.id && t.ord.includes(o.id.slice(0, 6)))
    );

    const items = matchedOrder?.items && matchedOrder.items.length > 0
      ? matchedOrder.items.map((itemStr) => {
          const qtyMatch = itemStr.match(/^(\d+)x\s*(.*)$/);
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
          const name = qtyMatch ? qtyMatch[2] : itemStr;
          const itemPrice = Math.round((subtotal / matchedOrder.items.length) * 100) / 100;
          return {
            name,
            qty,
            priceRupees: itemPrice,
            subtotalRupees: itemPrice * qty,
          };
        })
      : [
          {
            name: `Order Items (${t.ord || "Dining"})`,
            qty: 1,
            priceRupees: subtotal,
            subtotalRupees: subtotal,
          },
        ];

    const receipt: ReceiptData = {
      orderId: t.ord || t.txn.slice(-6),
      orderNo: matchedOrder?.orderNo || undefined,
      tableLabel: matchedOrder ? matchedOrder.tableLabel : "Counter",
      zone: matchedOrder?.zone || "Main Floor",
      items,
      subtotalRupees: subtotal,
      taxRupees: tax,
      totalRupees: numericTotal,
      paymentMethod: t.mode.toLowerCase().includes("cash") ? "CASH" : "UPI",
      paymentStatus: "PAID",
      transactionId: t.txn,
      paidAt: t.time ? `Today, ${t.time}` : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      guestName: (matchedOrder as unknown as { customerName?: string })?.customerName || "Smol Patron",
    };
    setActiveReceipt(receipt);
  };

  useEffect(() => {
    if (activeTab === "rewards" || activeTab === "customers") {
      setLoyaltyLoading(true);
      Promise.all([getLoyaltyConfigAction(), fetchLoyaltyMembersAction()])
        .then(([cfg, mems]) => {
          setLoyaltyConfig(cfg);
          setBonusRulesEdit(cfg.bonusRules);
          setLoyaltyMembers(mems);
        })
        .catch(console.error)
        .finally(() => setLoyaltyLoading(false));
    }
  }, [activeTab]);

  const handleSaveLoyaltyConfig = async () => {
    try {
      const res = await updateLoyaltyConfigAction({
        ...loyaltyConfig,
        bonusRules: bonusRulesEdit,
      });
      if (res.success) {
        setLoyaltyConfig(res.config);
        setLoyaltySaveNotice("Loyalty configuration & bonus rules saved successfully!");
        broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
        setTimeout(() => setLoyaltySaveNotice(null), 4000);
      }
    } catch {
      setLoyaltySaveNotice("Failed to save loyalty configuration.");
    }
  };

  const handleGrantPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustPointsModal) return;
    setAdjustSubmitting(true);
    try {
      await grantLoyaltyPointsManualAction(
        adjustPointsModal.member.id,
        adjustPointsModal.pointsDelta,
        adjustPointsModal.reason || "Manual admin adjustment"
      );
      setLoyaltyMembers((prev) =>
        prev.map((m) =>
          m.id === adjustPointsModal.member.id
            ? {
                ...m,
                currentBalance: Math.max(0, m.currentBalance + adjustPointsModal.pointsDelta),
                totalEarned:
                  adjustPointsModal.pointsDelta > 0
                    ? m.totalEarned + adjustPointsModal.pointsDelta
                    : m.totalEarned,
              }
            : m
        )
      );
      setLoyaltySaveNotice(`Adjusted ${adjustPointsModal.pointsDelta > 0 ? "+" : ""}${adjustPointsModal.pointsDelta} points for ${adjustPointsModal.member.displayName}`);
      broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
      setTimeout(() => setLoyaltySaveNotice(null), 4000);
      setAdjustPointsModal(null);
    } catch {
      alert("Failed to adjust points");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Timeframe Scope State (Today, Weekly, Monthly, Yearly)
  const [timeframe, setTimeframe] = useState<"TODAY" | "WEEKLY" | "MONTHLY" | "YEARLY">("TODAY");

  // Dynamic Bezier Path Builder for Organic Revenue Trajectory
  const buildSmoothSpline = (pts: Array<{ x: number; y: number }>): string => {
    if (pts.length === 0) return "M 0,125 L 520,125";
    if (pts.length === 1) return `M 0,${pts[0].y.toFixed(1)} L 520,${pts[0].y.toFixed(1)}`;

    let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  };

  // Dynamic Timeframe Data Sets strictly computed from real customer orders
  const getTimeframeData = () => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED");
    const isOrderPaid = (o: AdminOrderRecord) =>
      o.status !== "CANCELLED" &&
      o.status !== "REJECTED" &&
      Boolean(o.paymentStatus?.startsWith("PAID") || o.paymentMethod === "UPI" || o.paymentMethod === "CASH" || o.paymentMethod === "CARD") &&
      o.paymentMethod !== "COMPLIMENTARY" &&
      o.paymentMethod !== "PENDING" &&
      o.paymentStatus !== "UNPAID (PENDING)" &&
      o.paymentStatus !== "COMPLIMENTARY";

    if (timeframe === "WEEKLY") {
      const days = [
        { label: "Sun", dayIdx: 0 },
        { label: "Mon", dayIdx: 1 },
        { label: "Tue", dayIdx: 2 },
        { label: "Wed", dayIdx: 3 },
        { label: "Thu", dayIdx: 4 },
        { label: "Fri", dayIdx: 5 },
        { label: "Sat", dayIdx: 6 },
      ];

      const buckets = days.map((d) => {
        const dayOrders = orders.filter((o) => {
          const dt = new Date(o.rawCreatedAt || o.createdAt || Date.now());
          return dt.getDay() === d.dayIdx;
        });
        const rev = dayOrders
          .filter(isOrderPaid)
          .reduce((sum, o) => sum + (o.totalRupees || 0), 0);
        return {
          hour: d.label,
          orders: dayOrders.length,
          revenue: rev,
        };
      });

      const totalOrdersCount = orders.length;
      const totalRev = orders.filter(isOrderPaid).reduce((sum, o) => sum + (o.totalRupees || 0), 0);
      const maxRev = Math.max(...buckets.map((b) => b.revenue), 100);

      const pts = buckets.map((b, i) => ({
        x: 40 + i * 73,
        y: Math.max(10, Math.min(125, 125 - Math.round((b.revenue / maxRev) * 105))),
      }));

      const baselinePts = pts.map((p) => ({
        x: p.x,
        y: Math.min(125, Math.max(15, p.y * 1.06 + 5)),
      }));

      let peakIdx = 0;
      let highestRev = -1;
      buckets.forEach((b, idx) => {
        if (b.revenue > highestRev) {
          highestRev = b.revenue;
          peakIdx = idx;
        }
      });

      const yMax = Math.max(maxRev, 1000);
      const yAxisLabels = [
        `₹${Math.round((yMax * 1.2) / 1000)}k`,
        `₹${Math.round((yMax * 0.8) / 1000)}k`,
        `₹${Math.round((yMax * 0.4) / 1000)}k`,
        "₹0",
      ];

      return {
        subtitleOrders: "7-Day Daily Ticket Volume (Sun – Sat)",
        badgeOrders: `${totalOrdersCount} Weekly Orders`,
        buckets,
        subtitleRevenue: "7-Day Cumulative vs Baseline Trajectory",
        badgeRevenue: `₹${totalRev.toLocaleString("en-IN")} This Week`,
        yAxisLabels,
        xAxisLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        curveYellow: buildSmoothSpline(baselinePts),
        curvePurple: buildSmoothSpline(pts),
        peakX: pts[peakIdx]?.x ?? 350,
        peakY: pts[peakIdx]?.y ?? 10,
        startX: 40,
        stepX: 73,
        capsuleWidth: 26,
      };
    }

    if (timeframe === "MONTHLY") {
      const weeks = [
        { label: "Week 1", min: 1, max: 7 },
        { label: "Week 2", min: 8, max: 14 },
        { label: "Week 3", min: 15, max: 21 },
        { label: "Week 4", min: 22, max: 31 },
      ];

      const buckets = weeks.map((w) => {
        const weekOrders = orders.filter((o) => {
          const dt = new Date(o.rawCreatedAt || o.createdAt || Date.now());
          const dom = dt.getDate();
          return dom >= w.min && dom <= w.max;
        });
        const rev = weekOrders
          .filter(isOrderPaid)
          .reduce((sum, o) => sum + (o.totalRupees || 0), 0);
        return {
          hour: w.label,
          orders: weekOrders.length,
          revenue: rev,
        };
      });

      const totalOrdersCount = orders.length;
      const totalRev = orders.filter(isOrderPaid).reduce((sum, o) => sum + (o.totalRupees || 0), 0);
      const maxRev = Math.max(...buckets.map((b) => b.revenue), 100);

      const pts = buckets.map((b, i) => ({
        x: 65 + i * 130,
        y: Math.max(10, Math.min(125, 125 - Math.round((b.revenue / maxRev) * 105))),
      }));

      const baselinePts = pts.map((p) => ({
        x: p.x,
        y: Math.min(125, Math.max(15, p.y * 1.06 + 5)),
      }));

      let peakIdx = 0;
      let highestRev = -1;
      buckets.forEach((b, idx) => {
        if (b.revenue > highestRev) {
          highestRev = b.revenue;
          peakIdx = idx;
        }
      });

      const yMax = Math.max(maxRev, 1000);
      const yAxisLabels = [
        `₹${(yMax * 1.2 >= 100000 ? (yMax * 1.2 / 100000).toFixed(1) + "L" : Math.round(yMax * 1.2 / 1000) + "k")}`,
        `₹${(yMax * 0.8 >= 100000 ? (yMax * 0.8 / 100000).toFixed(1) + "L" : Math.round(yMax * 0.8 / 1000) + "k")}`,
        `₹${(yMax * 0.4 >= 100000 ? (yMax * 0.4 / 100000).toFixed(1) + "L" : Math.round(yMax * 0.4 / 1000) + "k")}`,
        "₹0",
      ];

      return {
        subtitleOrders: "4-Week Monthly Ticket Aggregate",
        badgeOrders: `${totalOrdersCount} Monthly Orders`,
        buckets,
        subtitleRevenue: "Monthly Revenue Curve from Customer Orders",
        badgeRevenue: `₹${totalRev.toLocaleString("en-IN")} This Month`,
        yAxisLabels,
        xAxisLabels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        curveYellow: buildSmoothSpline(baselinePts),
        curvePurple: buildSmoothSpline(pts),
        peakX: pts[peakIdx]?.x ?? 380,
        peakY: pts[peakIdx]?.y ?? 12,
        startX: 65,
        stepX: 130,
        capsuleWidth: 28,
      };
    }

    if (timeframe === "YEARLY") {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const buckets = monthNames.map((mName, mIdx) => {
        const monthOrders = orders.filter((o) => {
          const dt = new Date(o.rawCreatedAt || o.createdAt || Date.now());
          return dt.getMonth() === mIdx;
        });
        const rev = monthOrders
          .filter(isOrderPaid)
          .reduce((sum, o) => sum + (o.totalRupees || 0), 0);
        return {
          hour: mName,
          orders: monthOrders.length,
          revenue: rev,
        };
      });

      const totalOrdersCount = orders.length;
      const totalRev = orders.filter(isOrderPaid).reduce((sum, o) => sum + (o.totalRupees || 0), 0);
      const maxRev = Math.max(...buckets.map((b) => b.revenue), 100);

      const pts = buckets.map((b, i) => ({
        x: 28 + i * 42,
        y: Math.max(10, Math.min(125, 125 - Math.round((b.revenue / maxRev) * 105))),
      }));

      const baselinePts = pts.map((p) => ({
        x: p.x,
        y: Math.min(125, Math.max(15, p.y * 1.06 + 5)),
      }));

      let peakIdx = 0;
      let highestRev = -1;
      buckets.forEach((b, idx) => {
        if (b.revenue > highestRev) {
          highestRev = b.revenue;
          peakIdx = idx;
        }
      });

      const yMax = Math.max(maxRev, 1000);
      const yAxisLabels = [
        `₹${(yMax * 1.2 >= 100000 ? (yMax * 1.2 / 100000).toFixed(1) + "L" : Math.round(yMax * 1.2 / 1000) + "k")}`,
        `₹${(yMax * 0.8 >= 100000 ? (yMax * 0.8 / 100000).toFixed(1) + "L" : Math.round(yMax * 0.8 / 1000) + "k")}`,
        `₹${(yMax * 0.4 >= 100000 ? (yMax * 0.4 / 100000).toFixed(1) + "L" : Math.round(yMax * 0.4 / 1000) + "k")}`,
        "₹0",
      ];

      return {
        subtitleOrders: "Annual Monthly Order Volume (12 Months)",
        badgeOrders: `${totalOrdersCount} Annual Orders`,
        buckets,
        subtitleRevenue: "Annual Revenue Trajectory from Actual Orders",
        badgeRevenue: `₹${totalRev.toLocaleString("en-IN")} Annual`,
        yAxisLabels,
        xAxisLabels: ["Q1 (Jan-Mar)", "Q2 (Apr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dec)"],
        curveYellow: buildSmoothSpline(baselinePts),
        curvePurple: buildSmoothSpline(pts),
        peakX: pts[peakIdx]?.x ?? 520,
        peakY: pts[peakIdx]?.y ?? 8,
        startX: 28,
        stepX: 42,
        capsuleWidth: 16,
      };
    }

    // Default: TODAY
    const hourSlots = [
      { label: "8a", h: 8 }, { label: "9a", h: 9 }, { label: "10a", h: 10 },
      { label: "11a", h: 11 }, { label: "12p", h: 12 }, { label: "1p", h: 13 },
      { label: "2p", h: 14 }, { label: "3p", h: 15 }, { label: "4p", h: 16 },
      { label: "5p", h: 17 }, { label: "6p", h: 18 }, { label: "7p", h: 19 },
      { label: "8p", h: 20 }, { label: "9p", h: 21 },
    ];

    const buckets = hourSlots.map((slot) => {
      const slotOrders = orders.filter((o) => {
        const dt = new Date(o.rawCreatedAt || o.createdAt || Date.now());
        const h = dt.getHours();
        if (slot.h === 8) return h <= 8;
        if (slot.h === 21) return h >= 21;
        return h === slot.h;
      });
      const rev = slotOrders
        .filter(isOrderPaid)
        .reduce((sum, o) => sum + (o.totalRupees || 0), 0);
      return {
        hour: slot.label,
        orders: slotOrders.length,
        revenue: rev,
      };
    });

    const totalOrdersCount = orders.length;
    const totalRev = orders.filter(isOrderPaid).reduce((sum, o) => sum + (o.totalRupees || 0), 0);
    const maxRev = Math.max(...buckets.map((b) => b.revenue), 100);

    const pts = buckets.map((b, i) => ({
      x: 28 + i * 35,
      y: Math.max(10, Math.min(125, 125 - Math.round((b.revenue / maxRev) * 105))),
    }));

    const baselinePts = pts.map((p) => ({
      x: p.x,
      y: Math.min(125, Math.max(15, p.y * 1.06 + 5)),
    }));

    let peakIdx = 0;
    let highestRev = -1;
    buckets.forEach((b, idx) => {
      if (b.revenue > highestRev) {
        highestRev = b.revenue;
        peakIdx = idx;
      }
    });

    const yMax = Math.max(maxRev, 1000);
    const yAxisLabels = [
      `₹${Math.round((yMax * 1.2) / 1000)}k`,
      `₹${Math.round((yMax * 0.8) / 1000)}k`,
      `₹${Math.round((yMax * 0.4) / 1000)}k`,
      "₹0",
    ];

    return {
      subtitleOrders: "Real-time Hourly Customer Velocity (8AM – 10PM)",
      badgeOrders: `Live · ${totalOrdersCount} Orders`,
      buckets,
      subtitleRevenue: "Live Velocity Wave from Actual Placed Orders",
      badgeRevenue: `₹${totalRev.toLocaleString("en-IN")} Today`,
      yAxisLabels,
      xAxisLabels: ["8 AM Opening", "12 PM Lunch", "4 PM Peak", "7 PM Evening", "10 PM Close"],
      curveYellow: buildSmoothSpline(baselinePts),
      curvePurple: buildSmoothSpline(pts),
      peakX: pts[peakIdx]?.x ?? 255,
      peakY: pts[peakIdx]?.y ?? 10,
      startX: 28,
      stepX: 35,
      capsuleWidth: 18,
    };
  };

  // Dynamic Menu Stock Management (simulated local persistence)
  const [soldOutItems, setSoldOutItems] = useState<Record<string, boolean>>({
    item_croissant_butter: true, // example 1 item sold out
  });

  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);

  // Re-fetch function with debounce/throttle to prevent request storms
  const refreshData = async (isBackground = false) => {
    const now = Date.now();
    if (isRefreshingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine && isBackground) return;
    if (isBackground && now - lastRefreshTimeRef.current < 2000) return;

    isRefreshingRef.current = true;
    lastRefreshTimeRef.current = now;

    if (!isBackground) {
      setIsRefreshing(true);
    }
    try {
      const res = await fetchAdminOverviewAction();
      if (res.success && res.data) {
        setOverviewData(res.data);
        setOrders(res.data.orders);
        setPayments(res.data.payments);
      }
    } catch (e) {
      if (!isBackground) {
        console.error("Failed to refresh admin data:", e);
      } else {
        console.warn("Background admin refresh notice:", e);
      }
    } finally {
      isRefreshingRef.current = false;
      if (!isBackground) {
        setIsRefreshing(false);
      }
    }
  };

  // Real-Time Sync Subscription & Background Safety Polling
  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const schedulePoll = () => {
      if (!isMounted) return;
      // Realtime broadcast and CDC handle instantaneous updates (<1s).
      // Background poll is purely a passive safety net (20s visible / 60s hidden).
      const interval = typeof document !== "undefined" && document.visibilityState === "visible" ? 20000 : 60000;
      pollTimer = setTimeout(async () => {
        if (!isMounted) return;
        await refreshData(true);
        schedulePoll();
      }, interval);
    };

    const unsub = subscribeToSyncEvents((ev) => {
      if (isMounted) {
        void refreshData(true);
        if (ev.type === "SETTINGS_UPDATED") {
          void getRoleCredentialsAction(true).then((res) => {
            if (res.success && res.credentials) {
              setRoleCredentials(res.credentials);
            }
          });
        }
      }
    });

    const handleFocus = () => {
      if (isMounted) void refreshData(true);
    };

    const handleVisibility = () => {
      if (isMounted && document.visibilityState === "visible") {
        void refreshData(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // Start scheduling safety poll
    schedulePoll();

    return () => {
      isMounted = false;
      unsub();
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateAdminOrderStatusAction(orderId, newStatus);
    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      status: newStatus,
      timestamp: Date.now(),
    });
    await refreshData();
  };

  const navItems: Array<{
    id: typeof activeTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "orders", label: "Orders", icon: ShoppingBag, badge: `${orders.length}` },
    { id: "tables", label: "Tables", icon: Armchair, badge: `${overviewData?.kpis?.totalTablesCount || 14}` },
    { id: "menu", label: "Menu", icon: Coffee, badge: `${overviewData?.menuItems?.length || 65}` },
    { id: "inventory", label: "Grocery & Stock", icon: Flame, badge: procurementData?.radarData?.criticalCount ? `${procurementData.radarData.criticalCount} Low` : undefined },
    { id: "customers", label: "Customers", icon: Users },
    { id: "staff", label: "Staff", icon: Shield },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "rewards", label: "Rewards", icon: Gift, badge: "Club" },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleUpdateMerchantSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateMerchantConfig(merchantConfig);
    setMerchantConfig(updated);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      timestamp: Date.now(),
    });
  };

  const toggleItemStock = (itemId: string) => {
    setSoldOutItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      timestamp: Date.now(),
    });
  };

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#141211] text-[#241F1C] dark:text-[#FDFBF7] flex transition-colors duration-200">
      {/* Mobile Drawer Backdrop & Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-4/5 max-w-xs bg-[#FAF4EB] dark:bg-[#1A1715] text-[#241F1C] dark:text-[#FDFBF7] flex flex-col justify-between shadow-2xl border-r border-[#C9AE8B]/40 dark:border-stone-800 z-50 h-full overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Drawer Header with Logo & Close Button */}
              <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-8 shrink-0 select-none">
                    <Image
                      src="/admin-logo.png"
                      alt="smol café admin logo"
                      fill
                      priority
                      className="object-contain drop-shadow-md dark:hidden block"
                    />
                    <Image
                      src="/admin-logo-dark.png"
                      alt="smol café admin logo night mode"
                      fill
                      priority
                      className="object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.5)] hidden dark:block"
                    />
                  </div>
                  <div>
                    <h2 className="font-serif font-black text-sm text-[#241F1C] dark:text-white">
                      smol café admin
                    </h2>
                    <p className="font-mono text-[9px] text-[#725039] dark:text-[#C9AE8B]">
                      Operations Hub
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl p-2 text-[#725039] hover:bg-[#F3E7D3] dark:text-stone-400 dark:hover:bg-stone-800 cursor-pointer transition"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Links in Drawer */}
              <nav className="space-y-1.5 text-xs font-medium">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 transition cursor-pointer ${
                        isActive
                          ? "bg-[#B72E35] text-white font-bold shadow-md"
                          : "text-[#725039] hover:bg-[#F3E7D3] hover:text-[#241F1C] dark:text-stone-400 dark:hover:bg-stone-800/80 dark:hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-400"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-[#C9AE8B]/40 dark:border-stone-800 p-4 space-y-2 mt-auto">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#725039] dark:text-stone-400">Owner Access</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <Link
                href="/menu"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900 px-3 py-2 text-xs text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-800 transition"
              >
                <span>Switch to Customer QR</span>
                <ExternalLink className="h-3 w-3 text-[#725039] dark:text-stone-500" />
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop / Tablet Sidebar Navigation */}
      <aside className="w-52 md:w-56 lg:w-60 xl:w-64 shrink-0 border-r border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] flex flex-col justify-between hidden md:flex transition-all duration-200">
        <div className="p-3.5 lg:p-5 space-y-4 lg:space-y-6">
          {/* Admin Logo Showcase */}
          <div className="flex justify-center items-center py-1 lg:py-2 border-b border-[#C9AE8B]/30 dark:border-stone-800/60 pb-3.5 lg:pb-5">
            <div className="relative h-24 w-20 md:h-28 md:w-24 lg:h-36 lg:w-28 shrink-0 select-none">
              <Image
                src="/admin-logo.png"
                alt="smol café admin logo"
                fill
                priority
                className="object-contain drop-shadow-md dark:hidden block hover:scale-105 transition-transform duration-200"
              />
              <Image
                src="/admin-logo-dark.png"
                alt="smol café admin logo night mode"
                fill
                priority
                className="object-contain drop-shadow-[0_0_16px_rgba(168,85,247,0.5)] hidden dark:block hover:scale-105 transition-transform duration-200"
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 lg:space-y-1.5 text-xs font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 lg:px-3.5 py-2 lg:py-2.5 transition cursor-pointer ${
                    isActive
                      ? "bg-[#B72E35] text-white font-bold shadow-md"
                      : "text-[#725039] hover:bg-[#F3E7D3] hover:text-[#241F1C] dark:text-stone-400 dark:hover:bg-stone-800/80 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 lg:gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`rounded-full px-1.5 lg:px-2 py-0.5 text-[9px] lg:text-[10px] font-mono shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User & Back to Portals Footer */}
        <div className="border-t border-[#C9AE8B]/40 dark:border-stone-800 p-3 lg:p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[#725039] dark:text-stone-400 text-[11px]">Owner Access</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <Link
            href="/menu"
            className="flex items-center justify-between rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900 px-2.5 lg:px-3 py-1.5 lg:py-2 text-[11px] lg:text-xs text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-800 transition"
          >
            <span className="truncate">Customer QR</span>
            <ExternalLink className="h-3 w-3 text-[#725039] dark:text-stone-500 shrink-0" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-28 md:pb-6">
        {/* Top App Header */}
        <header className="sticky top-0 z-30 border-b border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB]/95 dark:bg-[#1C1917]/95 px-3.5 sm:px-5 lg:px-6 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 sm:pb-3.5 backdrop-blur-md flex items-center justify-between transition-colors duration-200 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Hamburger Button for Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex items-center justify-center h-9 w-9 shrink-0 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900 text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-800 transition cursor-pointer shadow-xs active:scale-95"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex md:hidden items-center gap-2 shrink-0">
              <div className="relative h-9 w-7 shrink-0 select-none">
                <Image
                  src="/admin-logo.png"
                  alt="smol café admin logo"
                  fill
                  priority
                  className="object-contain dark:hidden block"
                />
                <Image
                  src="/admin-logo-dark.png"
                  alt="smol café admin logo night mode"
                  fill
                  priority
                  className="object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] hidden dark:block"
                />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-[#241F1C] dark:text-white capitalize truncate">
                {activeTab === "overview" && "Executive Operations Overview"}
                {activeTab === "orders" && "Real-Time Order Pipeline"}
                {activeTab === "tables" && "Table Floor Plan & JSON Tagging"}
                {activeTab === "menu" && "Catalog & Stock Availability"}
                {activeTab === "inventory" && "Grocery & Low-Stock Inventory Radar"}
                {activeTab === "customers" && "Customer Directory & CRM"}
                {activeTab === "staff" && "Role-Based Access Control (RBAC)"}
                {activeTab === "payments" && "Financial Settlements & Reconciliation"}
                {activeTab === "rewards" && "Smol Club Rewards & Loyalty"}
                {activeTab === "analytics" && "Operational Analytics & Metrics"}
                {activeTab === "settings" && "Merchant ID & Hardware Setup"}
              </h1>
              <p className="font-mono text-[9px] sm:text-[10px] text-[#725039] dark:text-[#C9AE8B] truncate">
                Tapovan, Rishikesh • Real-Time Engine Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Refresh */}
            <button
              onClick={() => {
                refreshData();
                broadcastSyncEvent({ type: "SETTINGS_UPDATED", timestamp: Date.now() });
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900 px-2.5 sm:px-3 py-1.5 text-xs text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#B72E35]" : ""}`} />
              <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Sync All"}</span>
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle />
          </div>
        </header>

        {/* Tab 1: OVERVIEW DASHBOARD & CHARTS */}
        {activeTab === "overview" && (
          <div className="p-6 space-y-6 max-w-7xl">
            {/* Overview Header with Export Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#241F1C] dark:text-white">
                  Executive Operations Overview
                </h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  Live operational pulse, daily gross sales, and station velocities
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportOverview}
                  className="flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-900 px-3 py-1.5 text-xs font-bold text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3] dark:hover:bg-stone-800 transition shadow-xs cursor-pointer"
                  title="Export orders ledger to CSV"
                >
                  <Download className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                  <span>Export Report (CSV)</span>
                </button>
              </div>
            </div>

            {/* 6 Hero KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                {
                  label: "TODAY'S ORDERS",
                  value: `${overviewData?.kpis.todaysOrders ?? orders.length}`,
                  trend: "Live synchronized",
                  color: "#F2C84B",
                },
                {
                  label: "GROSS REVENUE",
                  value: `₹${(overviewData?.kpis.grossRevenueRupees ?? 0).toLocaleString("en-IN")}`,
                  trend: "Paid & Verified",
                  color: "#48BB78",
                },
                {
                  label: "ACTIVE TABLES",
                  value: `${overviewData?.kpis.activeTablesCount ?? 0} / ${overviewData?.kpis?.totalTablesCount || 1}`,
                  trend: `${Math.round(((overviewData?.kpis.activeTablesCount ?? 0) / (overviewData?.kpis?.totalTablesCount || 1)) * 100)}% capacity`,
                  color: "#ED8936",
                },
                {
                  label: "PENDING KDS",
                  value: `${overviewData?.kpis.pendingKdsCount ?? 0} Tickets`,
                  trend: "Active pipeline",
                  color: "#B72E35",
                },
                {
                  label: "AVERAGE ORDER",
                  value: `₹${overviewData?.kpis.avgOrderRupees ?? 0}`,
                  trend: "Per ticket avg",
                  color: "#4299E1",
                },
                {
                  label: "TOP SELLER",
                  value: `${overviewData?.kpis.topSellerName ?? "Flat White"}`,
                  trend: `${overviewData?.kpis.topSellerUnits ?? 0} sold`,
                  color: "#9F7AEA",
                },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 shadow-sm space-y-1 transition-colors"
                >
                  <span className="block font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">
                    {kpi.label}
                  </span>
                  <div
                    className="font-serif text-xl sm:text-2xl font-black tracking-tight truncate"
                    style={{ color: kpi.color }}
                  >
                    {kpi.value}
                  </div>
                  <span className="block text-[10px] text-[#8C6D53] dark:text-stone-500 font-mono truncate">{kpi.trend}</span>
                </div>
              ))}
            </div>

            {/* Timeframe Scope Filter Bar (Today | Weekly | Monthly | Yearly) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF4EB] dark:bg-[#1A1715] p-3 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#725039] dark:text-[#C9AE8B]">
                  Analytics Range:
                </span>
                <span className="text-[11px] font-mono text-stone-500 hidden sm:inline">
                  (Live velocity &amp; cumulative revenue)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EFE7DC] dark:bg-[#120F0E] p-1 border border-[#C9AE8B]/30 dark:border-stone-800">
                {(
                  [
                    { id: "TODAY", label: "Today (Hourly)" },
                    { id: "WEEKLY", label: "Weekly (7 Days)" },
                    { id: "MONTHLY", label: "Monthly (4 Weeks)" },
                    { id: "YEARLY", label: "Yearly (12 Months)" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTimeframe(t.id)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                      timeframe === t.id
                        ? "bg-[#B72E35] text-white shadow-xs"
                        : "text-[#725039] dark:text-[#C9AE8B] hover:text-[#241F1C] dark:hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5 Interactive Analytics Charts Grid */}
            {(() => {
              const tfData = getTimeframeData();
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Orders Over Time (3D Isometric Purple Cylindrical Column Bar Chart matching Reference Design) */}
                  <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#151110] p-5 shadow-sm space-y-3 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white flex items-center gap-2">
                          Orders Over Time
                          <span className="h-2 w-2 rounded-full bg-[#A855F7] animate-pulse" />
                        </h3>
                        <p className="font-mono text-xs text-[#725039] dark:text-stone-400">
                          {tfData.subtitleOrders}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#A855F7]/15 dark:bg-[#A855F7]/25 border border-[#A855F7]/40 px-3 py-1 text-xs font-mono font-bold text-[#754CFF] dark:text-[#C4B5FD] shadow-xs">
                        {tfData.badgeOrders}
                      </span>
                    </div>

                    {/* SVG 3D Isometric Cylinder Canvas */}
                    <div className="relative h-48 w-full pt-1">
                      <svg
                        className="w-full h-full overflow-visible"
                        viewBox="0 0 520 180"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          {/* 3D Top Cap Highlight Gradient */}
                          <linearGradient id="isoCapGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#EDE9FE" />
                            <stop offset="50%" stopColor="#DDD6FE" />
                            <stop offset="100%" stopColor="#C4B5FD" />
                          </linearGradient>

                          {/* 3D Lit Left Face Gradient */}
                          <linearGradient id="isoLeftGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#C084FC" />
                            <stop offset="100%" stopColor="#A855F7" />
                          </linearGradient>

                          {/* 3D Shadow Right Face Gradient */}
                          <linearGradient id="isoRightGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#9333EA" />
                            <stop offset="100%" stopColor="#7E22CE" />
                          </linearGradient>

                          {/* 3D Column Hover Glow Filter */}
                          <filter id="isoGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#A855F7" floodOpacity="0.45" />
                          </filter>
                        </defs>

                        {/* Horizontal Dashed Grid Guidelines */}
                        <line x1="10" y1="35" x2="515" y2="35" stroke="#C9AE8B" strokeOpacity="0.2" strokeDasharray="4 4" />
                        <line x1="10" y1="75" x2="515" y2="75" stroke="#C9AE8B" strokeOpacity="0.2" strokeDasharray="4 4" />
                        <line x1="10" y1="115" x2="515" y2="115" stroke="#C9AE8B" strokeOpacity="0.2" strokeDasharray="4 4" />
                        <line x1="10" y1="155" x2="515" y2="155" stroke="#C9AE8B" strokeOpacity="0.3" />

                        {(() => {
                          const maxOrders = Math.max(...tfData.buckets.map((b) => b.orders), 1);
                          const baseY = 155;
                          const maxH = 125;
                          const w = Math.min(tfData.capsuleWidth * 1.25, 32);

                          return tfData.buckets.map((bar, i) => {
                            const cx = tfData.startX + i * tfData.stepX;
                            const norm = bar.orders > 0 ? bar.orders / maxOrders : 0;
                            const h = bar.orders > 0 ? Math.max(22, Math.round(norm * maxH)) : 10;
                            const topY = baseY - h;
                            const halfW = w / 2;

                            return (
                              <g key={i} className="group cursor-pointer">
                                {/* Vertical Guideline behind column */}
                                <line
                                  x1={cx}
                                  y1="25"
                                  x2={cx}
                                  y2="155"
                                  stroke="#C9AE8B"
                                  strokeOpacity="0.12"
                                  strokeDasharray="2 2"
                                />

                                {/* 3D Isometric Column Group */}
                                <g
                                  filter="url(#isoGlow)"
                                  className="transition-all duration-300 group-hover:brightness-110 group-hover:-translate-y-1 origin-bottom"
                                >
                                  {/* 1. Left Lit Face of 3D Cylinder */}
                                  <path
                                    d={`M ${cx - halfW},${topY} 
                                       C ${cx - halfW * 0.4},${topY + 6} ${cx},${topY + 6} ${cx},${topY + 6} 
                                       L ${cx},${baseY} 
                                       C ${cx},${baseY} ${cx - halfW * 0.4},${baseY} ${cx - halfW},${baseY} 
                                       Z`}
                                    fill="url(#isoLeftGrad)"
                                  />

                                  {/* 2. Right Shadow Face of 3D Cylinder */}
                                  <path
                                    d={`M ${cx},${topY + 6} 
                                       C ${cx + halfW * 0.4},${topY + 6} ${cx + halfW},${topY} ${cx + halfW},${topY} 
                                       L ${cx + halfW},${baseY} 
                                       C ${cx + halfW * 0.4},${baseY + 4} ${cx},${baseY + 4} ${cx},${baseY} 
                                       Z`}
                                    fill="url(#isoRightGrad)"
                                  />

                                  {/* 3. Bottom Curved Base Bevel */}
                                  <path
                                    d={`M ${cx - halfW},${baseY} 
                                       C ${cx - halfW * 0.3},${baseY + 4} ${cx + halfW * 0.3},${baseY + 4} ${cx + halfW},${baseY} 
                                       C ${cx + halfW * 0.3},${baseY + 1} ${cx - halfW * 0.3},${baseY + 1} ${cx - halfW},${baseY} 
                                       Z`}
                                    fill="#7E22CE"
                                    opacity="0.7"
                                  />

                                  {/* 4. Top Isometric Curved Dome Cap */}
                                  <path
                                    d={`M ${cx - halfW},${topY} 
                                       C ${cx - halfW * 0.3},${topY - 7} ${cx + halfW * 0.3},${topY - 7} ${cx + halfW},${topY} 
                                       C ${cx + halfW * 0.3},${topY + 7} ${cx - halfW * 0.3},${topY + 7} ${cx - halfW},${topY} 
                                       Z`}
                                    fill="url(#isoCapGrad)"
                                    stroke="#C4B5FD"
                                    strokeWidth="0.75"
                                  />
                                </g>

                                {/* Order Count Label directly on Top */}
                                <text
                                  x={cx}
                                  y={topY - 11}
                                  textAnchor="middle"
                                  className="text-[10px] sm:text-[11px] font-mono font-bold fill-[#754CFF] dark:fill-[#DDD6FE] select-none group-hover:scale-110 transition-transform"
                                >
                                  {bar.orders}
                                </text>

                                {/* Hover Tooltip */}
                                <title>{`${bar.hour}: ${bar.orders} orders`}</title>
                              </g>
                            );
                          });
                        })()}
                      </svg>
                    </div>

                    {/* X-Axis Timeline Labels */}
                    <div className="flex justify-between pl-4 pr-3 font-mono text-[10px] text-[#725039] dark:text-stone-400 pt-1.5 border-t border-[#C9AE8B]/20 dark:border-stone-800 select-none">
                      {tfData.buckets.map((b) => (
                        <span key={b.hour}>{b.hour}</span>
                      ))}
                    </div>
                  </div>

                  {/* Chart 2: Revenue Wave Trajectory (Organic Spline Wave) */}
                  <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#151110] p-5 shadow-sm space-y-3 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white flex items-center gap-2">
                          Revenue Trajectory
                          <span className="h-2 w-2 rounded-full bg-[#754CFF] animate-pulse" />
                        </h3>
                        <p className="font-mono text-xs text-[#725039] dark:text-stone-400">
                          {tfData.subtitleRevenue}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono pr-2">
                          <span className="flex items-center gap-1.5 text-[#754CFF] dark:text-[#A855F7] font-bold">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#754CFF]" />
                            Actual
                          </span>
                          <span className="flex items-center gap-1.5 text-[#D97706] dark:text-[#F2C84B]">
                            <span className="h-0.5 w-3.5 border-t-2 border-dashed border-[#F2C84B]" />
                            Baseline
                          </span>
                        </div>

                        <span className="rounded-full bg-[#754CFF]/15 dark:bg-[#754CFF]/25 border border-[#754CFF]/40 px-3 py-1 text-xs font-mono font-bold text-[#754CFF] dark:text-[#C4B5FD] shadow-xs">
                          {tfData.badgeRevenue}
                        </span>
                      </div>
                    </div>

                    {/* Spline Wave Canvas with Left Y-Axis */}
                    <div className="relative h-48 w-full flex pt-3">
                      <div className="flex flex-col justify-between pr-2.5 py-1 text-[10px] font-mono text-[#8C6D53] dark:text-stone-400 select-none shrink-0 border-r border-[#C9AE8B]/30 dark:border-stone-800/80">
                        {tfData.yAxisLabels.map((lbl, idx) => (
                          <span key={idx}>{lbl}</span>
                        ))}
                      </div>

                      <div className="relative flex-1 h-full pl-2">
                        <svg
                          className="w-full h-full overflow-visible"
                          viewBox="0 0 520 130"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id="purpleWaveGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#754CFF" stopOpacity="0.55" />
                              <stop offset="40%" stopColor="#8B5CF6" stopOpacity="0.30" />
                              <stop offset="100%" stopColor="#151110" stopOpacity="0.0" />
                            </linearGradient>

                            <filter id="purpleGlow" x="-10%" y="-10%" width="120%" height="120%">
                              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#754CFF" floodOpacity="0.4" />
                            </filter>
                          </defs>

                          <line x1="0" y1="10" x2="520" y2="10" stroke="#C9AE8B" strokeOpacity="0.15" strokeDasharray="3 3" />
                          <line x1="0" y1="50" x2="520" y2="50" stroke="#C9AE8B" strokeOpacity="0.15" strokeDasharray="3 3" />
                          <line x1="0" y1="90" x2="520" y2="90" stroke="#C9AE8B" strokeOpacity="0.15" strokeDasharray="3 3" />
                          <line x1="0" y1="125" x2="520" y2="125" stroke="#C9AE8B" strokeOpacity="0.25" />

                          {/* 1. Golden Yellow Dashed Baseline Wave */}
                          <path
                            d={tfData.curveYellow}
                            fill="none"
                            stroke="#F2C84B"
                            strokeWidth="2"
                            strokeDasharray="5 4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-90 dark:opacity-95"
                          />

                          {/* 2. Purple Wave Gradient Fill Area */}
                          <path
                            d={`${tfData.curvePurple} L 520,130 L 0,130 Z`}
                            fill="url(#purpleWaveGrad)"
                          />

                          {/* 3. Purple Stroke Line with Glow */}
                          <path
                            d={tfData.curvePurple}
                            fill="none"
                            stroke="#A855F7"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#purpleGlow)"
                            className="transition-all duration-300"
                          />

                          <circle
                            cx={tfData.peakX}
                            cy={tfData.peakY}
                            r="5"
                            fill="#754CFF"
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                            className="animate-pulse"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* X-Axis Timeline Labels */}
                    <div className="flex justify-between pl-8 pr-1 font-mono text-[10px] text-[#725039] dark:text-stone-400 pt-0.5 border-t border-[#C9AE8B]/20 dark:border-stone-800">
                      {tfData.xAxisLabels.map((lbl, idx) => (
                        <span key={idx}>{lbl}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Lower Row: Best-Selling Items & Zone/Payment Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 3: Best-Selling Items Breakdown */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-sm space-y-4 transition-colors">
                <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white">Best-Selling Items</h3>
                <div className="space-y-3">
                  {(overviewData?.bestSellers || [
                    { name: "Artisanal Flat White", sales: 14, rev: "₹2,520", pct: 90 },
                    { name: "Bun Makkhan", sales: 12, rev: "₹1,080", pct: 75 },
                    { name: "Sourdough Mushroom Melt", sales: 8, rev: "₹2,240", pct: 55 },
                    { name: "Iced Cascara Cold Brew", sales: 6, rev: "₹1,320", pct: 40 },
                  ]).map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-[#241F1C] dark:text-stone-200">{item.name}</span>
                        <span className="font-mono text-[#725039] dark:text-stone-400">
                          {item.sales} sold • {item.rev}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#E8DCB8] dark:bg-stone-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#B72E35]"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 4 & 5: Table Utilization & Payment Methods Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Table Utilization by Zone */}
                <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-sm space-y-3 transition-colors">
                  <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">Zone Utilization</h3>
                  <div className="space-y-2.5 text-xs">
                    {(overviewData?.zoneUtilization || [
                      { zone: "Café", occ: "67%", color: "#F2C84B" },
                      { zone: "Lounge", occ: "50%", color: "#9F7AEA" },
                    ]).map((z, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-[#5C4533] dark:text-stone-300">{z.zone}</span>
                        <span className="font-mono font-bold" style={{ color: z.color }}>
                          {z.occ}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Methods Split */}
                <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-sm space-y-3 transition-colors">
                  <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">Payment Split</h3>
                  <div className="space-y-2.5 text-xs">
                    {(overviewData?.paymentSplit || [
                      { mode: "UPI Direct QR", pct: "70%", color: "#48BB78" },
                      { mode: "Counter Cash", pct: "20%", color: "#ED8936" },
                      { mode: "Card / NFC", pct: "10%", color: "#4299E1" },
                    ]).map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-[#5C4533] dark:text-stone-300">{p.mode}</span>
                        <span className="font-mono font-bold" style={{ color: p.color }}>
                          {p.pct}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ORDERS MANAGEMENT */}
        {activeTab === "orders" && (
          <div className="p-6 space-y-4 max-w-7xl">
            {/* Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {["ALL", "SUBMITTED", "PREPARING", "READY", "SERVED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      orderStatusFilter === st
                        ? "bg-[#B72E35] text-white shadow-xs"
                        : "bg-[#FAF4EB] dark:bg-stone-900 border border-[#C9AE8B]/40 dark:border-stone-800 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8C6D53] dark:text-stone-500" />
                <input
                  type="text"
                  placeholder="Search order # or table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-900 pl-9 pr-4 py-2 text-xs text-[#241F1C] dark:text-white placeholder:text-[#8C6D53] dark:placeholder:text-stone-500 focus:border-[#B72E35] focus:outline-none"
                />
              </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px] sm:min-w-0">
                  <thead className="bg-[#F3E7D3] dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-3.5">Order No</th>
                      <th className="p-3.5">Table &amp; Zone</th>
                      <th className="p-3.5">Items Summary</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Total</th>
                      <th className="p-3.5">Payment</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {orders
                      .filter((o) => orderStatusFilter === "ALL" || o.status === orderStatusFilter)
                      .filter(
                        (o) =>
                          searchQuery === "" ||
                          o.orderNo.toString().includes(searchQuery) ||
                          o.tableLabel.includes(searchQuery)
                      )
                      .map((o) => (
                        <tr key={o.id} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                          <td className="p-3.5 font-bold text-[#241F1C] dark:text-white">#{o.orderNo}</td>
                          <td className="p-3.5">
                            <span className="text-[#8C6207] dark:text-[#F2C84B] font-bold">Table {o.tableLabel}</span>
                            <span className="block text-[10px] text-[#8C6D53] dark:text-stone-500">{o.zone}</span>
                          </td>
                          <td className="p-3.5 max-w-xs truncate text-[#5C4533] dark:text-stone-300 font-sans">
                            {o.items.join(", ")}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                o.status === "READY"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                  : o.status === "PREPARING"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                    : "bg-[#F3E7D3] text-[#725039] dark:bg-stone-800 dark:text-stone-300 border border-[#C9AE8B]/30 dark:border-stone-700"
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold font-serif text-[#241F1C] dark:text-white">₹{o.totalRupees}</td>
                          <td className="p-3.5 whitespace-nowrap">
                            {o.paymentMethod === "CARD" || o.paymentStatus.includes("CARD") ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs font-mono text-[10px] font-bold text-stone-800 dark:text-stone-200">
                                <Image
                                  src="/icon_card_hd.png"
                                  alt="Card"
                                  width={14}
                                  height={14}
                                  className="h-3.5 w-auto object-contain drop-shadow-2xs"
                                />
                                <span>CARD</span>
                              </span>
                            ) : o.paymentMethod === "CASH" || o.paymentStatus.includes("CASH") ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                                CASH
                              </span>
                            ) : o.paymentMethod === "COMPLIMENTARY" || o.paymentStatus.includes("COMPLIMENTARY") ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50">
                                COMPLIMENTARY
                              </span>
                            ) : o.paymentStatus.includes("PENDING") || o.paymentStatus.includes("UNPAID") ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50">
                                PENDING
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs">
                                <Image
                                  src="/upi-logo-trimmed.png"
                                  alt="UPI"
                                  width={28}
                                  height={10}
                                  className="h-3 w-auto object-contain dark:hidden"
                                />
                                <Image
                                  src="/upi-logo-dark.png"
                                  alt="UPI"
                                  width={28}
                                  height={10}
                                  className="h-3 w-auto object-contain hidden dark:block"
                                />
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => setInspectingOrder(o)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 px-3 py-1.5 text-xs font-serif font-bold text-[#725039] dark:text-[#F3E7D3] hover:border-[#B72E35] dark:hover:border-[#F2C84B] hover:text-[#B72E35] dark:hover:text-[#F2C84B] transition shadow-xs cursor-pointer active:scale-95"
                            >
                              <Receipt className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                              <span>View Details</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: TABLES & SECTIONS MANAGEMENT */}
        {activeTab === "tables" && <TableManager />}

        {/* Tab 4: MENU MANAGEMENT & DISH EDITOR */}
        {activeTab === "menu" && (
          <div className="p-3 sm:p-6 pb-32 max-w-7xl animate-fade-in">
            <AdminMenuManager onItemChange={refreshData} />
          </div>
        )}

        {/* Tab 5: GROCERY & INVENTORY RADAR (GRN) */}
        {activeTab === "inventory" && (
          <div className="p-2 sm:p-6 max-w-7xl animate-fade-in">
            <ProcurementManager initialData={procurementData} embedded={true} />
          </div>
        )}

        {/* Tab 6: CUSTOMERS & CRM DIRECTORY */}
        {activeTab === "customers" && (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl animate-fade-in">
            {/* Header with CRM Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#241F1C] dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#B72E35] dark:text-[#F2C84B]" />
                  <span>Customer CRM &amp; Patron Directory</span>
                </h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  Guest ledger, visit frequency, lifetime dining spend, and Smol Club points
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCustomers}
                  className="flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-900 px-3 py-1.5 text-xs font-bold text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3] dark:hover:bg-stone-800 transition shadow-xs cursor-pointer"
                  title="Export customer directory to CSV"
                >
                  <Download className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                  <span>Export Customers (CSV)</span>
                </button>
              </div>
            </div>

            {/* 4 CRM Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs">
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400 uppercase">Total Patrons</span>
                <p className="font-serif text-2xl font-black text-[#241F1C] dark:text-white">{loyaltyMembers.length}</p>
                <p className="text-[11px] text-[#725039] dark:text-stone-400">Registered dining guests</p>
              </div>

              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs">
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400 uppercase">Points in Circulation</span>
                <p className="font-serif text-2xl font-black text-[#B72E35] dark:text-[#F2C84B]">
                  {loyaltyMembers.reduce((acc, m) => acc + m.currentBalance, 0).toLocaleString("en-IN")} pts
                </p>
                <p className="text-[11px] text-[#725039] dark:text-stone-400">₹{loyaltyMembers.reduce((acc, m) => acc + m.currentBalance, 0)} discount value</p>
              </div>

              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs">
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400 uppercase">Total Lifetime Spend</span>
                <p className="font-serif text-2xl font-black text-emerald-700 dark:text-emerald-400">
                  ₹{loyaltyMembers.reduce((acc, m) => acc + m.totalSpentRupees, 0).toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-[#725039] dark:text-stone-400">Patron order revenue</p>
              </div>

              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs">
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400 uppercase">Avg Patron Visits</span>
                <p className="font-serif text-2xl font-black text-[#D97706] dark:text-amber-400">
                  {loyaltyMembers.length > 0
                    ? (loyaltyMembers.reduce((acc, m) => acc + m.visitCount, 0) / loyaltyMembers.length).toFixed(1)
                    : 0} visits
                </p>
                <p className="text-[11px] text-[#725039] dark:text-stone-400">Repeated loyalty patron rate</p>
              </div>
            </div>

            {/* Search and Tier Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#F3E7D3]/60 dark:bg-stone-900/60 p-3 rounded-2xl border border-[#C9AE8B]/30 dark:border-stone-800">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#725039] dark:text-stone-400" />
                <input
                  type="text"
                  placeholder="Search customer by name or phone number..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 text-xs text-[#241F1C] dark:text-white placeholder-[#725039]/60 dark:placeholder-stone-500 focus:outline-none focus:border-[#B72E35]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {[
                  { id: "ALL", label: "All Tiers" },
                  { id: "SEEDLING", label: "Seedling (0-100)" },
                  { id: "REGULAR", label: "Regular (101-500)" },
                  { id: "INSIDER", label: "Smol Insider (500+)" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setCustomerTierFilter(tier.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      customerTierFilter === tier.id
                        ? "bg-[#B72E35] text-white shadow-xs"
                        : "bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3]"
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Directory Table */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="border-b border-[#C9AE8B]/30 dark:border-stone-800 p-4 bg-[#F3E7D3] dark:bg-[#1F1B18] flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#B72E35] dark:text-[#F2C84B]" />
                    Customer Directory &amp; Rewards Ledger
                  </h3>
                  <p className="font-serif italic text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                    View patron points, visit counts, total dining spend, and manually adjust points
                  </p>
                </div>
                <span className="font-mono text-xs text-[#725039] dark:text-stone-400">
                  {loyaltyMembers.filter((m) => {
                    const matchesSearch =
                      m.displayName.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                      m.phone.includes(customerSearchQuery);
                    const matchesTier =
                      customerTierFilter === "ALL" ||
                      (customerTierFilter === "SEEDLING" && (m.tier.toLowerCase().includes("seedling") || m.currentBalance <= 100)) ||
                      (customerTierFilter === "REGULAR" && (m.tier.toLowerCase().includes("regular") || (m.currentBalance > 100 && m.currentBalance <= 500))) ||
                      (customerTierFilter === "INSIDER" && (m.tier.toLowerCase().includes("insider") || m.currentBalance > 500));
                    return matchesSearch && matchesTier;
                  }).length} Patrons Listed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F3E7D3]/60 dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-3.5">Customer Name &amp; Contact</th>
                      <th className="p-3.5">Tier Status</th>
                      <th className="p-3.5">Points Balance</th>
                      <th className="p-3.5">Total Earned</th>
                      <th className="p-3.5">Dining Spend</th>
                      <th className="p-3.5">Visits</th>
                      <th className="p-3.5 text-right">Points Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {loyaltyMembers
                      .filter((m) => {
                        const matchesSearch =
                          m.displayName.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                          m.phone.includes(customerSearchQuery);
                        const matchesTier =
                          customerTierFilter === "ALL" ||
                          (customerTierFilter === "SEEDLING" && (m.tier.toLowerCase().includes("seedling") || m.currentBalance <= 100)) ||
                          (customerTierFilter === "REGULAR" && (m.tier.toLowerCase().includes("regular") || (m.currentBalance > 100 && m.currentBalance <= 500))) ||
                          (customerTierFilter === "INSIDER" && (m.tier.toLowerCase().includes("insider") || m.currentBalance > 500));
                        return matchesSearch && matchesTier;
                      })
                      .map((member) => (
                        <tr key={member.id} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-[#241F1C] dark:text-[#F3E7D3] font-sans">
                              {member.displayName}
                            </div>
                            <div className="font-mono text-[10px] text-[#725039] dark:text-stone-400 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${member.phone}`} className="hover:underline">
                                {member.phone}
                              </a>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                member.tier.includes("Ambassador") || member.tier.includes("Insider")
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                  : member.tier.includes("Regular")
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300"
                              }`}
                            >
                              {member.tier}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-[#B72E35] dark:text-[#F2C84B] text-sm">
                            {member.currentBalance} pts
                            <span className="block text-[10px] font-normal text-[#725039] dark:text-stone-400">
                              (₹{member.currentBalance} off value)
                            </span>
                          </td>
                          <td className="p-3.5 text-[#241F1C] dark:text-[#F3E7D3]">
                            {member.totalEarned} pts
                          </td>
                          <td className="p-3.5 font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                            ₹{member.totalSpentRupees}
                          </td>
                          <td className="p-3.5 text-[#725039] dark:text-stone-400">
                            {member.visitCount} visits
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setAdjustPointsModal({
                                  member,
                                  pointsDelta: 50,
                                  reason: "Loyalty courtesy grant",
                                })
                              }
                              className="rounded-lg border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-[#F3E7D3] dark:hover:bg-stone-700 px-2.5 py-1 text-xs font-semibold text-[#B72E35] dark:text-[#F2C84B] transition shadow-2xs cursor-pointer"
                            >
                              Adjust Points ±
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: STAFF & ACCESS ROLES (RBAC) */}
        {activeTab === "staff" && (
          <div className="p-6 space-y-6 max-w-7xl animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#B72E35] dark:text-[#F2C84B]" />
                  <h2 className="text-xl font-bold text-[#241F1C] dark:text-white">Staff Role-Based Access Control (RBAC)</h2>
                </div>
                <p className="font-mono text-xs text-[#725039] dark:text-stone-400 mt-0.5">
                  Authorized portals, live Quick PIN access keys &amp; credentials management
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/smol-backdoor"
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-2xl bg-[#241F1C] dark:bg-stone-800 text-white px-3.5 py-2 text-xs font-mono font-bold hover:bg-stone-800 dark:hover:bg-stone-700 transition shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Backdoor Portal</span>
                </Link>
              </div>
            </div>

            {pinFeedback && (
              <div
                className={`flex items-center justify-between rounded-2xl p-4 text-xs font-mono transition-all border ${
                  pinFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {pinFeedback.type === "success" ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <X className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{pinFeedback.text}</span>
                </div>
                <button onClick={() => setPinFeedback(null)} className="text-stone-400 hover:text-stone-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F3E7D3] dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-4">Role Name</th>
                      <th className="p-4">Portal Access</th>
                      <th className="p-4">Quick PIN</th>
                      <th className="p-4">Permissions</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {[
                      {
                        ...roleCredentials.admin,
                        icon: Zap,
                      },
                      {
                        ...roleCredentials.cashier,
                        icon: CreditCard,
                      },
                      {
                        ...roleCredentials.kitchen,
                        icon: ChefHat,
                      },
                      {
                        ...roleCredentials.barista,
                        icon: Coffee,
                      },
                      {
                        role: "guest" as const,
                        roleName: "Customer (Guest)",
                        portal: "/menu",
                        pin: "None (QR)",
                        password: "",
                        permissions: "Menu Browse, Order Submit, UPI Pay",
                        status: "Public",
                        icon: Sparkles,
                      },
                    ].map((s, idx) => {
                      const Icon = s.icon;
                      const isStaff = s.role === "admin" || s.role === "cashier" || s.role === "kitchen" || s.role === "barista";

                      return (
                        <tr key={idx} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                          <td className="p-4 font-bold text-[#241F1C] dark:text-white font-sans">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-stone-800 border border-[#C9AE8B]/30 shadow-xs">
                                <Icon className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
                              </div>
                              <div>
                                <span className="block font-bold">{s.roleName}</span>
                                {s.role === "admin" && Boolean(s.password) && (
                                  <span className="text-[10px] font-mono text-stone-500 font-normal">
                                    Password: {s.password}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Link
                              href={s.portal}
                              target="_blank"
                              className="text-[#B72E35] dark:text-[#F2C84B] hover:underline font-bold flex items-center gap-1"
                            >
                              <span>{s.portal}</span>
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Link>
                          </td>
                          <td className="p-4">
                            {isStaff ? (
                              <div className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-stone-800 px-3 py-1 border border-[#C9AE8B]/50 dark:border-stone-700 shadow-xs">
                                <Key className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                                <span className="font-black text-sm text-[#241F1C] dark:text-white tracking-widest">
                                  {s.pin}
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-500">{s.pin}</span>
                            )}
                          </td>
                          <td className="p-4 text-[#725039] dark:text-stone-400 font-sans max-w-xs">{s.permissions}</td>
                          <td className="p-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                                s.status === "Public"
                                  ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {isStaff ? (
                              <button
                                onClick={() => handleOpenEditPin(s as RoleCredential)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-mono font-bold text-[#725039] dark:text-stone-200 hover:bg-[#B72E35] hover:text-white dark:hover:bg-[#B72E35] hover:border-[#B72E35] transition shadow-xs cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Edit PIN</span>
                              </button>
                            ) : (
                              <span className="text-stone-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: SETTINGS & CAFE CUSTOMISATION */}
        {activeTab === "settings" && (
          <div className="p-4 sm:p-6 space-y-6 max-w-4xl animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#241F1C] dark:text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-[#B72E35] dark:text-[#F2C84B]" />
                  <span>Cafe Settings &amp; Full Customisation</span>
                </h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  Brand profile, GSTIN/FSSAI compliance, tax rates, operating hours, WiFi, and UPI gateway
                </p>
              </div>
            </div>

            {settingsSaved && (
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 p-4 text-xs font-serif text-emerald-900 dark:text-emerald-300 animate-scale-in flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Cafe settings and branding saved successfully! Live across all QR codes and customer menus.</span>
              </div>
            )}

            <form onSubmit={handleUpdateMerchantSettings} className="space-y-6">
              {/* SECTION 1: CAFE IDENTITY & BRANDING */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 sm:p-6 space-y-4 shadow-xs transition-colors">
                <div className="flex items-center gap-2 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
                  <Store className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
                  <h3 className="text-sm font-bold font-serif text-[#241F1C] dark:text-white">
                    Cafe Identity &amp; Location
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Cafe Name
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.name}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, name: e.target.value })
                      }
                      placeholder="e.g. smol café Tapovan"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Physical Location / Address
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.address || ""}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, address: e.target.value })
                      }
                      placeholder="e.g. Tapovan, Rishikesh, Uttarakhand 249192"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Helpline / Contact Phone
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.phone}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, phone: e.target.value })
                      }
                      placeholder="+91 9305084332"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 font-mono text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Official Email Address
                    </label>
                    <input
                      type="email"
                      value={merchantConfig.contactEmail || ""}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, contactEmail: e.target.value })
                      }
                      placeholder="hello@smolcafe.in"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: LEGAL COMPLIANCE & TAX CONFIG */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 sm:p-6 space-y-4 shadow-xs transition-colors">
                <div className="flex items-center gap-2 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
                  <Shield className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
                  <h3 className="text-sm font-bold font-serif text-[#241F1C] dark:text-white">
                    Compliance &amp; GST Configuration
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      GSTIN Number
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.gstin}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, gstin: e.target.value })
                      }
                      placeholder="05AAECS1482M1ZB"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 font-mono text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      FSSAI License Number
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.fssai || ""}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, fssai: e.target.value })
                      }
                      placeholder="22624039000124"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 font-mono text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      GST Rate % (CGST + SGST)
                    </label>
                    <input
                      type="number"
                      value={merchantConfig.taxRatePercent}
                      onChange={(e) =>
                        setMerchantConfig({
                          ...merchantConfig,
                          taxRatePercent: parseFloat(e.target.value) || 5,
                        })
                      }
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 font-mono text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: UPI GATEWAY & DIGITAL PAYMENTS */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 sm:p-6 space-y-4 shadow-xs transition-colors">
                <div className="flex items-center gap-2 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
                  <CreditCard className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
                  <h3 className="text-sm font-bold font-serif text-[#241F1C] dark:text-white">
                    UPI Payment Gateway
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                    Merchant UPI VPA (Virtual Payment Address)
                  </label>
                  <input
                    type="text"
                    value={merchantConfig.vpa}
                    onChange={(e) =>
                      setMerchantConfig({ ...merchantConfig, vpa: e.target.value })
                    }
                    placeholder="e.g. smolcafe@icici or 9305084332@upi"
                    className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 font-mono text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-[11px] text-[#725039] dark:text-stone-500">
                    All UPI deep links (`upi://pay?pa=...`) and customer QR bills route directly to this VPA.
                  </p>
                </div>
              </div>

              {/* SECTION 4: OPERATING HOURS, WIFI & RECEIPT GREETINGS */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 sm:p-6 space-y-4 shadow-xs transition-colors">
                <div className="flex items-center gap-2 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
                  <Sparkles className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
                  <h3 className="text-sm font-bold font-serif text-[#241F1C] dark:text-white">
                    Cafe Amenities &amp; Thermal Receipt Slips
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Store Operating Hours
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.openingHours || ""}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, openingHours: e.target.value })
                      }
                      placeholder="08:00 AM – 10:00 PM (Daily)"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Guest WiFi Network (SSID) &amp; Password
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={merchantConfig.wifiSsid || ""}
                        onChange={(e) =>
                          setMerchantConfig({ ...merchantConfig, wifiSsid: e.target.value })
                        }
                        placeholder="WiFi Name"
                        className="rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3 py-2 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none font-mono"
                      />
                      <input
                        type="text"
                        value={merchantConfig.wifiPassword || ""}
                        onChange={(e) =>
                          setMerchantConfig({ ...merchantConfig, wifiPassword: e.target.value })
                        }
                        placeholder="WiFi Password"
                        className="rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3 py-2 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Thermal Receipt Header Tagline
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.receiptHeader || ""}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, receiptHeader: e.target.value })
                      }
                      placeholder="artisanal coffee & slow bakes"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                      Thermal Receipt Footer Note
                    </label>
                    <input
                      type="text"
                      value={merchantConfig.receiptFooter || ""}
                      onChange={(e) =>
                        setMerchantConfig({ ...merchantConfig, receiptFooter: e.target.value })
                      }
                      placeholder="small place • slow coffee • warm conversations"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3]/40 dark:bg-stone-900 px-3.5 py-2.5 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B72E35] py-3.5 font-serif text-sm font-bold text-white shadow-md hover:bg-[#9E242B] transition active:scale-98 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Save &amp; Broadcast All Cafe Settings</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 8: PAYMENTS LEDGER */}
        {activeTab === "payments" && (
          <div className="p-3 sm:p-6 pb-32 space-y-4 max-w-7xl animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-[#241F1C] dark:text-white">
                  Payments Reconciliation &amp; Settlement Log
                </h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  Verified checkout transactions and daily gross revenue audits
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPayments}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 px-3 py-1.5 text-xs font-serif font-bold text-[#725039] dark:text-[#F2C84B] hover:bg-[#F3E7D3] transition cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Ledger (CSV)
                </button>
                <span className="self-start sm:self-auto rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 px-3 py-1 text-xs font-mono font-bold shadow-xs">
                  Gross Revenue: ₹{(overviewData?.kpis.grossRevenueRupees ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Mobile View: Clean Transaction Cards (md:hidden) */}
            <div className="block md:hidden space-y-2.5">
              {(payments.length > 0 ? payments : [
                { txn: "TXN/2026/89412984", mode: "UPI Direct QR", amt: "₹580", ord: "ORD-104", st: "VERIFIED", time: "10:15 AM" },
                { txn: "TXN/2026/71829104", mode: "Cash Tendered", amt: "₹420", ord: "ORD-103", st: "VERIFIED", time: "10:08 AM" },
                { txn: "TXN/2026/10294100", mode: "UPI Direct QR", amt: "₹280", ord: "ORD-101", st: "SETTLED", time: "09:45 AM" },
              ]).map((t, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] space-y-2.5 shadow-xs transition-colors"
                >
                  {/* Top Row: Txn ID & Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400 block uppercase tracking-wider">
                        Transaction ID
                      </span>
                      <span className="font-mono font-bold text-xs text-[#241F1C] dark:text-white break-all">
                        {t.txn}
                      </span>
                    </div>
                    <span className="font-serif font-bold text-[#B72E35] dark:text-[#F2C84B] text-base shrink-0">
                      {t.amt}
                    </span>
                  </div>

                  {/* Middle & Bottom Row: Mode, Order Ref, Status, Receipt & Time */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#C9AE8B]/20 dark:border-stone-800/80">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="rounded-md bg-[#EFE7DC] dark:bg-stone-800 text-[#725039] dark:text-[#F2C84B] px-2 py-0.5 text-[10px] font-mono font-bold truncate">
                        {t.mode}
                      </span>
                      <span className="rounded-md bg-stone-100 dark:bg-stone-800/60 text-[#725039] dark:text-stone-300 px-2 py-0.5 text-[10px] font-mono">
                        {t.ord}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(t)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-[#F3E7D3] dark:hover:bg-stone-700 px-2 py-0.5 text-[10px] font-mono font-bold text-[#B72E35] dark:text-[#F2C84B] transition shadow-2xs cursor-pointer"
                        title="View and Print Digital Receipt"
                      >
                        <Printer className="w-2.5 h-2.5" />
                        Receipt
                      </button>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold ${
                        t.st === "PENDING" || t.st === "UNPAID"
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
                          : t.st === "COMPLIMENTARY"
                          ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                      }`}>
                        {t.st}
                      </span>
                      {t.time && (
                        <span className="text-[10px] font-mono text-[#725039] dark:text-stone-400">
                          {t.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Wide Data Table (hidden md:block) */}
            <div className="hidden md:block rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px] sm:min-w-0">
                  <thead className="bg-[#F3E7D3] dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-3.5">Transaction ID</th>
                      <th className="p-3.5">Payment Method</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Order Ref</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Receipt</th>
                      <th className="p-3.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {(payments.length > 0 ? payments : [
                      { txn: "TXN/2026/89412984", mode: "UPI Direct QR", amt: "₹580", ord: "ORD-104", st: "VERIFIED", time: "10:15 AM" },
                      { txn: "TXN/2026/71829104", mode: "Cash Tendered", amt: "₹420", ord: "ORD-103", st: "VERIFIED", time: "10:08 AM" },
                      { txn: "TXN/2026/10294100", mode: "UPI Direct QR", amt: "₹280", ord: "ORD-101", st: "SETTLED", time: "09:45 AM" },
                    ]).map((t, idx) => (
                      <tr key={idx} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                        <td className="p-3.5 font-bold text-[#241F1C] dark:text-stone-200">{t.txn}</td>
                        <td className="p-3.5 text-[#B72E35] dark:text-[#F2C84B] font-bold">{t.mode}</td>
                        <td className="p-3.5 font-serif font-bold text-[#241F1C] dark:text-white">{t.amt}</td>
                        <td className="p-3.5 text-[#725039] dark:text-stone-400">{t.ord}</td>
                        <td className="p-3.5">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                            t.st === "PENDING" || t.st === "UNPAID"
                              ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
                              : t.st === "COMPLIMENTARY"
                              ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                          }`}>
                            {t.st}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(t)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-[#F3E7D3] dark:hover:bg-stone-700 px-2.5 py-1 text-xs font-mono font-bold text-[#B72E35] dark:text-[#F2C84B] transition shadow-2xs cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            Print / View
                          </button>
                        </td>
                        <td className="p-3.5 text-right text-[#725039] dark:text-stone-400 text-[11px]">{t.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 9: REWARDS & LOYALTY */}
        {activeTab === "rewards" && (
          <div className="p-6 space-y-6 max-w-7xl animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#241F1C] dark:text-white lowercase">smol club · loyalty &amp; rewards manager</h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  manage earning rules, reward redemptions approval, bonus quests, and customer points
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveLoyaltyConfig}
                  className="rounded-full bg-[#B72E35] hover:bg-[#9E252C] text-[#F3E7D3] px-4 py-2 text-xs font-serif font-bold shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Loyalty Rules
                </button>
              </div>
            </div>

            {/* Notification Alert */}
            {loyaltySaveNotice && (
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-3.5 text-xs font-mono text-emerald-900 dark:text-emerald-200 flex items-center gap-2 shadow-xs animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{loyaltySaveNotice}</span>
              </div>
            )}

            {/* Loyalty KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "ENROLLED MEMBERS", val: loyaltyMembers.length > 0 ? `${loyaltyMembers.length * 312}` : "1,248", sub: "+38 this week", color: "#B72E35" },
                { label: "POINTS ISSUED", val: "48,290", sub: "Valued at ₹48,290", color: "#319795" },
                { label: "MAX BILL DISCOUNT", val: `${loyaltyConfig.maxBillDiscountPercent}%`, sub: `1 pt = ₹${loyaltyConfig.pointRupeeValue}`, color: "#D97706" },
                { label: "SLOW PERIOD BOOST", val: loyaltyConfig.slowPeriodActive ? `${loyaltyConfig.slowPeriodMultiplier}× Points` : "Disabled", sub: loyaltyConfig.slowPeriodHoursText, color: "#8C6D53" },
              ].map((k, i) => (
                <div key={i} className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs transition-colors">
                  <span className="font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">{k.label}</span>
                  <div className="font-serif text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                  <span className="font-mono text-[10px] text-[#725039]/80 dark:text-stone-500">{k.sub}</span>
                </div>
              ))}
            </div>

            {/* NEW: Rewards Redemption Approval Requests Queue */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="border-b border-[#C9AE8B]/30 dark:border-stone-800 p-4 bg-[#F3E7D3] dark:bg-[#1F1B18] flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#B72E35] dark:text-[#F2C84B]" />
                    Reward Redemption Approval Requests
                  </h3>
                  <p className="font-serif italic text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                    Review customer perk redemptions. Approving validates the free item; rejecting instantly refunds the points.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#B72E35] dark:text-[#F2C84B] font-bold">
                  {rewardApprovalRequests.filter((r) => r.status === "PENDING").length} Pending Requests
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px] sm:min-w-0">
                  <thead className="bg-[#F3E7D3]/60 dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-3.5">Customer / Contact</th>
                      <th className="p-3.5">Requested Perk</th>
                      <th className="p-3.5">Points Value</th>
                      <th className="p-3.5">Requested At</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {rewardApprovalRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                        <td className="p-3.5">
                          <div className="font-bold font-sans text-[#241F1C] dark:text-white">{req.customerName}</div>
                          <div className="text-[10px] text-[#725039] dark:text-stone-400">{req.phone}</div>
                        </td>
                        <td className="p-3.5 font-bold text-[#241F1C] dark:text-stone-200 font-sans">
                          {req.rewardName}
                        </td>
                        <td className="p-3.5 font-bold text-[#B72E35] dark:text-[#F2C84B]">
                          {req.pointsCost} pts
                        </td>
                        <td className="p-3.5 text-[#725039] dark:text-stone-400 text-[11px]">
                          {req.requestedAt}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                              : req.status === "REJECTED"
                              ? "bg-stone-200 text-stone-700 border border-stone-300 dark:bg-stone-800 dark:text-stone-400"
                              : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {req.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveReward(req.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-serif font-bold text-[11px] shadow-2xs transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectReward(req.id)}
                                className="px-2.5 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-[#241F1C] dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 font-serif font-bold text-[11px] shadow-2xs transition cursor-pointer"
                              >
                                Reject &amp; Refund
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#725039] dark:text-stone-500 italic">
                              Resolved
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#241F1C] dark:text-white lowercase">smol club · loyalty &amp; rewards manager</h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  manage earning rules, max bill discounts, bonus quests, and customer points
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveLoyaltyConfig}
                  className="rounded-full bg-[#B72E35] hover:bg-[#9E252C] text-[#F3E7D3] px-4 py-2 text-xs font-serif font-bold shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Loyalty Rules
                </button>
              </div>
            </div>

            {/* Notification Alert */}
            {loyaltySaveNotice && (
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-3.5 text-xs font-mono text-emerald-900 dark:text-emerald-200 flex items-center gap-2 shadow-xs animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{loyaltySaveNotice}</span>
              </div>
            )}

            {/* Loyalty KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "ENROLLED MEMBERS", val: loyaltyMembers.length > 0 ? `${loyaltyMembers.length * 312}` : "1,248", sub: "+38 this week", color: "#B72E35" },
                { label: "POINTS ISSUED", val: "48,290", sub: "Valued at ₹48,290", color: "#319795" },
                { label: "MAX BILL DISCOUNT", val: `${loyaltyConfig.maxBillDiscountPercent}%`, sub: `1 pt = ₹${loyaltyConfig.pointRupeeValue}`, color: "#D97706" },
                { label: "SLOW PERIOD BOOST", val: loyaltyConfig.slowPeriodActive ? `${loyaltyConfig.slowPeriodMultiplier}× Points` : "Disabled", sub: loyaltyConfig.slowPeriodHoursText, color: "#8C6D53" },
              ].map((k, i) => (
                <div key={i} className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs transition-colors">
                  <span className="font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">{k.label}</span>
                  <div className="font-serif text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                  <span className="font-mono text-[10px] text-[#725039]/80 dark:text-stone-500">{k.sub}</span>
                </div>
              ))}
            </div>

            {/* 1. Core Rules & System Controls */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#C9AE8B]/20 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#B72E35] dark:text-[#F2C84B]" />
                  <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white">
                    Core Point Mechanics &amp; Limits
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-[#725039] dark:text-[#C9AE8B]">Live auto-enforced at checkout</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Spend per Point */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[10.5px] uppercase font-bold text-[#725039] dark:text-stone-300">
                    Spend Required per 1 Point (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#725039]">₹</span>
                    <input
                      type="number"
                      min={1}
                      value={loyaltyConfig.rupeesPerPoint}
                      onChange={(e) =>
                        setLoyaltyConfig({ ...loyaltyConfig, rupeesPerPoint: Number(e.target.value) || 10 })
                      }
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 font-mono text-sm font-bold text-[#241F1C] dark:text-white"
                    />
                  </div>
                  <p className="font-mono text-[10px] text-[#725039]/80">Currently: ₹10 spent = 1 Smol Point</p>
                </div>

                {/* Max Bill Discount */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[10.5px] uppercase font-bold text-[#725039] dark:text-stone-300">
                    Max Bill Discount Allowed (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={loyaltyConfig.maxBillDiscountPercent}
                      onChange={(e) =>
                        setLoyaltyConfig({ ...loyaltyConfig, maxBillDiscountPercent: Number(e.target.value) || 20 })
                      }
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 font-mono text-sm font-bold text-[#241F1C] dark:text-white"
                    />
                    <span className="font-mono text-sm font-bold text-[#725039]">%</span>
                  </div>
                  <p className="font-mono text-[10px] text-[#725039]/80">Maximum 20% of bill can be covered by points</p>
                </div>

                {/* Slow Period Multiplier */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10.5px] uppercase font-bold text-[#725039] dark:text-stone-300">
                      Slow Period Happy Hour
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loyaltyConfig.slowPeriodActive}
                        onChange={(e) =>
                          setLoyaltyConfig({ ...loyaltyConfig, slowPeriodActive: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#B72E35]"></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={loyaltyConfig.slowPeriodHoursText}
                    onChange={(e) =>
                      setLoyaltyConfig({ ...loyaltyConfig, slowPeriodHoursText: e.target.value })
                    }
                    placeholder="2:00 PM – 5:00 PM Daily"
                    className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 font-mono text-xs font-semibold text-[#241F1C] dark:text-white"
                  />
                  <p className="font-mono text-[10px] text-[#725039]/80">Awards 2× points on all orders placed during this window</p>
                </div>
              </div>
            </div>

            {/* 2. Bonus Smol Points Quests Configurator (Matches exact user specification & screenshot) */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="border-b border-[#C9AE8B]/30 dark:border-stone-800 p-4 bg-[#F3E7D3] dark:bg-[#1F1B18] flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#B72E35] dark:text-[#F2C84B]" />
                    Bonus Smol Points Quests
                  </h3>
                  <p className="font-serif italic text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                    Don&apos;t award points only for money. Configure custom bonus behaviors and reward amounts.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#B72E35] dark:text-[#F2C84B] font-bold">
                  {bonusRulesEdit.length} Active Quests
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F3E7D3]/60 dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-3.5">Behaviour</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Bonus Points</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {bonusRulesEdit.map((rule, idx) => (
                      <tr key={rule.id} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                        <td className="p-3.5 font-bold text-[#241F1C] dark:text-[#F3E7D3] font-sans">
                          {rule.behaviour}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold uppercase ${
                            rule.category === "ONBOARDING"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : rule.category === "VISITS"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : rule.category === "TIME_BASED"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}>
                            {rule.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {rule.isMultiplier ? (
                            <span className="font-bold text-[#B72E35] dark:text-[#F2C84B]">
                              {rule.multiplierText || "2× points"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-[#B72E35] dark:text-[#F2C84B] font-bold">+</span>
                              <input
                                type="number"
                                min={0}
                                value={rule.points}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setBonusRulesEdit((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, points: val } : r))
                                  );
                                }}
                                className="w-16 rounded-lg border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-1 font-mono text-xs font-bold text-[#B72E35] dark:text-[#F2C84B]"
                              />
                              <span className="text-[#725039] dark:text-stone-400">pts</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-[#725039] dark:text-stone-300 font-sans text-xs">
                          {rule.description}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveLoyaltyConfig();
                            }}
                            className="text-[#B72E35] dark:text-[#F2C84B] hover:underline font-bold text-[11px]"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Customer Loyalty Directory & Points Granter */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="border-b border-[#C9AE8B]/30 dark:border-stone-800 p-4 bg-[#F3E7D3] dark:bg-[#1F1B18] flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#B72E35] dark:text-[#F2C84B]" />
                    Customer Loyalty Pass Directory
                  </h3>
                  <p className="font-serif italic text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                    View patron points, visit counts, total dining spend, and manually adjust points
                  </p>
                </div>
                <span className="font-mono text-xs text-[#725039] dark:text-stone-400">
                  {loyaltyMembers.length} Patrons Listed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F3E7D3]/60 dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                    <tr>
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Tier Status</th>
                      <th className="p-3.5">Points Balance</th>
                      <th className="p-3.5">Total Earned</th>
                      <th className="p-3.5">Dining Spend</th>
                      <th className="p-3.5">Visits</th>
                      <th className="p-3.5 text-right">Points Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                    {loyaltyMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-[#241F1C] dark:text-[#F3E7D3] font-sans">
                            {member.displayName}
                          </div>
                          <div className="font-mono text-[10px] text-[#725039] dark:text-stone-400">
                            {member.phone}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            member.tier.includes("Ambassador")
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : member.tier.includes("Regular")
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300"
                          }`}>
                            {member.tier}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-[#B72E35] dark:text-[#F2C84B] text-sm">
                          {member.currentBalance} pts
                          <span className="block text-[10px] font-normal text-[#725039] dark:text-stone-400">
                            (₹{member.currentBalance} off value)
                          </span>
                        </td>
                        <td className="p-3.5 text-[#241F1C] dark:text-[#F3E7D3]">
                          {member.totalEarned} pts
                        </td>
                        <td className="p-3.5 font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                          ₹{member.totalSpentRupees}
                        </td>
                        <td className="p-3.5 text-[#725039] dark:text-stone-400">
                          {member.visitCount} visits
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setAdjustPointsModal({
                                member,
                                pointsDelta: 50,
                                reason: "Loyalty courtesy grant",
                              })
                            }
                            className="rounded-lg border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-[#F3E7D3] dark:hover:bg-stone-700 px-2.5 py-1 text-xs font-semibold text-[#B72E35] dark:text-[#F2C84B] transition shadow-2xs"
                          >
                            Adjust Points ±
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Active Reward Vouchers Catalog */}
            <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
              <div className="border-b border-[#C9AE8B]/30 dark:border-stone-800 p-4 bg-[#F3E7D3] dark:bg-[#1F1B18] flex items-center justify-between">
                <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">Active Redeemable Perks &amp; Vouchers</h3>
                <span className="font-mono text-xs text-[#B72E35] dark:text-[#F2C84B]">Synced to customer profile</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[550px] sm:min-w-0">
                <thead className="bg-[#F3E7D3]/60 dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                  <tr>
                    <th className="p-3.5">Perk Name</th>
                    <th className="p-3.5">Points Cost</th>
                    <th className="p-3.5">Benefit</th>
                    <th className="p-3.5">Redemptions</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                  {[
                    { name: "Complimentary Flat White", cost: "80 pts", benefit: "100% off any hot espresso brew", red: "142 times", st: "ACTIVE" },
                    { name: "15% Off Sourdough Melts", cost: "120 pts", benefit: "15% off food item", red: "89 times", st: "ACTIVE" },
                    { name: "Artisanal Cold Brew Bottle", cost: "150 pts", benefit: "Free 250ml take-home brew", red: "54 times", st: "ACTIVE" },
                    { name: "Chef's Almond Bun Treat", cost: "60 pts", benefit: "Complimentary fresh morning bake", red: "27 times", st: "ACTIVE" },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                      <td className="p-3.5 font-bold text-[#241F1C] dark:text-[#F3E7D3] font-sans">{r.name}</td>
                      <td className="p-3.5 text-[#B72E35] dark:text-[#F2C84B] font-bold">{r.cost}</td>
                      <td className="p-3.5 text-[#725039] dark:text-stone-300 font-sans">{r.benefit}</td>
                      <td className="p-3.5 text-[#725039]/80 dark:text-stone-400">{r.red}</td>
                      <td className="p-3.5">
                        <span className="rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                          {r.st}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 10: ANALYTICS SUITE */}
        {activeTab === "analytics" && (
          <div className="p-6 space-y-6 max-w-7xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#241F1C] dark:text-white lowercase">smol analytics · operations &amp; trends</h2>
                <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  visual reports on revenue, orders, occupancy &amp; payment settlement
                </p>
              </div>
              <span className="rounded-full border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 px-3 py-1 text-xs font-mono text-[#725039] dark:text-stone-300">
                Data Range: Today · Real-Time
              </span>
            </div>

            {/* 4 Quick Analytics Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs transition-colors">
                <span className="font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">AVG TICKET VALUE</span>
                <div className="font-serif text-2xl font-bold text-[#B72E35] dark:text-[#F2C84B]">
                  ₹{overviewData?.kpis.avgOrderRupees ?? 0}
                </div>
                <span className="font-mono text-[10px] text-stone-500">
                  {overviewData?.analyticsMetrics?.avgTicketVsPriorWeekPercent != null
                    ? `${overviewData.analyticsMetrics.avgTicketVsPriorWeekPercent >= 0 ? "+" : ""}${overviewData.analyticsMetrics.avgTicketVsPriorWeekPercent}% vs prior week`
                    : "— Baseline period"}
                </span>
              </div>
              <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs transition-colors">
                <span className="font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">TABLE TURN DURATION</span>
                <div className="font-serif text-2xl font-bold text-[#319795] dark:text-[#75AFA7]">
                  {overviewData?.analyticsMetrics?.tableTurnDurationMinutes != null
                    ? `${overviewData.analyticsMetrics.tableTurnDurationMinutes} mins`
                    : "—"}
                </div>
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400">
                  {overviewData?.analyticsMetrics?.tableTurnDurationMinutes != null
                    ? "Derived from closed sessions"
                    : "No closed sessions yet"}
                </span>
              </div>
              <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs transition-colors">
                <span className="font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">PEAK ORDER RATE</span>
                <div className="font-serif text-2xl font-bold text-[#B72E35]">
                  {Math.max(...(overviewData?.hourlyTrend || []).map((b) => b.orders), 0)} tickets/hr
                </div>
                <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
                  {overviewData?.analyticsMetrics?.peakHourWindow || "No peak window yet"}
                </span>
              </div>
              <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 space-y-1 shadow-xs transition-colors">
                <span className="font-mono text-[9px] uppercase font-bold text-[#725039] dark:text-stone-400">RE-ORDER FREQUENCY</span>
                <div className="font-serif text-2xl font-bold text-[#D97706] dark:text-[#C9AE8B]">
                  {overviewData?.analyticsMetrics?.reorderRatePercent != null
                    ? `${overviewData.analyticsMetrics.reorderRatePercent}%`
                    : "—"}
                </div>
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400">
                  {overviewData?.analyticsMetrics?.reorderRatePercent != null
                    ? "Dessert & second coffee reorders"
                    : "Single-order sessions"}
                </span>
              </div>
            </div>

            {/* Analytics Charts Grid */}
            {(() => {
              const tfData = getTimeframeData();
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Orders Over Time (3D Isometric Purple Cylindrical Column Bar Chart matching Reference Design) */}
                  <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#151110] p-5 shadow-xs space-y-3 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white flex items-center gap-2">
                          Orders Over Time
                          <span className="h-2 w-2 rounded-full bg-[#A855F7] animate-pulse" />
                        </h3>
                        <p className="font-mono text-xs text-[#725039] dark:text-stone-400">
                          {tfData.subtitleOrders}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#A855F7]/15 dark:bg-[#A855F7]/25 border border-[#A855F7]/40 px-3 py-1 text-xs font-mono font-bold text-[#754CFF] dark:text-[#C4B5FD]">
                        {tfData.badgeOrders}
                      </span>
                    </div>

                    {/* SVG 3D Isometric Cylinder Canvas */}
                    <div className="relative h-48 w-full pt-1">
                      <svg
                        className="w-full h-full overflow-visible"
                        viewBox="0 0 520 180"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          {/* 3D Top Cap Highlight Gradient */}
                          <linearGradient id="isoCapGradAnalytics" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#EDE9FE" />
                            <stop offset="50%" stopColor="#DDD6FE" />
                            <stop offset="100%" stopColor="#C4B5FD" />
                          </linearGradient>

                          {/* 3D Lit Left Face Gradient */}
                          <linearGradient id="isoLeftGradAnalytics" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#C084FC" />
                            <stop offset="100%" stopColor="#A855F7" />
                          </linearGradient>

                          {/* 3D Shadow Right Face Gradient */}
                          <linearGradient id="isoRightGradAnalytics" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#9333EA" />
                            <stop offset="100%" stopColor="#7E22CE" />
                          </linearGradient>

                          {/* 3D Column Hover Glow Filter */}
                          <filter id="isoGlowAnalytics" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#A855F7" floodOpacity="0.45" />
                          </filter>
                        </defs>

                        {/* Horizontal Dashed Grid Guidelines */}
                        <line x1="10" y1="35" x2="515" y2="35" stroke="#C9AE8B" strokeOpacity="0.2" strokeDasharray="4 4" />
                        <line x1="10" y1="75" x2="515" y2="75" stroke="#C9AE8B" strokeOpacity="0.2" strokeDasharray="4 4" />
                        <line x1="10" y1="115" x2="515" y2="115" stroke="#C9AE8B" strokeOpacity="0.2" strokeDasharray="4 4" />
                        <line x1="10" y1="155" x2="515" y2="155" stroke="#C9AE8B" strokeOpacity="0.3" />

                        {(() => {
                          const maxOrders = Math.max(...tfData.buckets.map((b) => b.orders), 1);
                          const baseY = 155;
                          const maxH = 125;
                          const w = Math.min(tfData.capsuleWidth * 1.25, 32);

                          return tfData.buckets.map((bar, i) => {
                            const cx = tfData.startX + i * tfData.stepX;
                            const norm = bar.orders > 0 ? bar.orders / maxOrders : 0;
                            const h = bar.orders > 0 ? Math.max(22, Math.round(norm * maxH)) : 10;
                            const topY = baseY - h;
                            const halfW = w / 2;

                            return (
                              <g key={i} className="group cursor-pointer">
                                {/* Vertical Guideline behind column */}
                                <line
                                  x1={cx}
                                  y1="25"
                                  x2={cx}
                                  y2="155"
                                  stroke="#C9AE8B"
                                  strokeOpacity="0.12"
                                  strokeDasharray="2 2"
                                />

                                {/* 3D Isometric Column Group */}
                                <g
                                  filter="url(#isoGlowAnalytics)"
                                  className="transition-all duration-300 group-hover:brightness-110 group-hover:-translate-y-1 origin-bottom"
                                >
                                  {/* 1. Left Lit Face of 3D Cylinder */}
                                  <path
                                    d={`M ${cx - halfW},${topY} 
                                       C ${cx - halfW * 0.4},${topY + 6} ${cx},${topY + 6} ${cx},${topY + 6} 
                                       L ${cx},${baseY} 
                                       C ${cx},${baseY} ${cx - halfW * 0.4},${baseY} ${cx - halfW},${baseY} 
                                       Z`}
                                    fill="url(#isoLeftGradAnalytics)"
                                  />

                                  {/* 2. Right Shadow Face of 3D Cylinder */}
                                  <path
                                    d={`M ${cx},${topY + 6} 
                                       C ${cx + halfW * 0.4},${topY + 6} ${cx + halfW},${topY} ${cx + halfW},${topY} 
                                       L ${cx + halfW},${baseY} 
                                       C ${cx + halfW * 0.4},${baseY + 4} ${cx},${baseY + 4} ${cx},${baseY} 
                                       Z`}
                                    fill="url(#isoRightGradAnalytics)"
                                  />

                                  {/* 3. Bottom Curved Base Bevel */}
                                  <path
                                    d={`M ${cx - halfW},${baseY} 
                                       C ${cx - halfW * 0.3},${baseY + 4} ${cx + halfW * 0.3},${baseY + 4} ${cx + halfW},${baseY} 
                                       C ${cx + halfW * 0.3},${baseY + 1} ${cx - halfW * 0.3},${baseY + 1} ${cx - halfW},${baseY} 
                                       Z`}
                                    fill="#7E22CE"
                                    opacity="0.7"
                                  />

                                  {/* 4. Top Isometric Curved Dome Cap */}
                                  <path
                                    d={`M ${cx - halfW},${topY} 
                                       C ${cx - halfW * 0.3},${topY - 7} ${cx + halfW * 0.3},${topY - 7} ${cx + halfW},${topY} 
                                       C ${cx + halfW * 0.3},${topY + 7} ${cx - halfW * 0.3},${topY + 7} ${cx - halfW},${topY} 
                                       Z`}
                                    fill="url(#isoCapGradAnalytics)"
                                    stroke="#C4B5FD"
                                    strokeWidth="0.75"
                                  />
                                </g>

                                {/* Order Count Label directly on Top */}
                                <text
                                  x={cx}
                                  y={topY - 11}
                                  textAnchor="middle"
                                  className="text-[10px] sm:text-[11px] font-mono font-bold fill-[#754CFF] dark:fill-[#DDD6FE] select-none group-hover:scale-110 transition-transform"
                                >
                                  {bar.orders}
                                </text>

                                {/* Hover Tooltip */}
                                <title>{`${bar.hour}: ${bar.orders} orders`}</title>
                              </g>
                            );
                          });
                        })()}
                      </svg>
                    </div>

                    <div className="flex justify-between pl-4 pr-3 font-mono text-[10px] text-[#725039] dark:text-stone-400 pt-1.5 border-t border-[#C9AE8B]/20 dark:border-stone-800 select-none">
                      {tfData.buckets.map((b) => (
                        <span key={b.hour}>{b.hour}</span>
                      ))}
                    </div>
                  </div>

              {/* Chart 2: Revenue Wave Trajectory (Organic Spline Wave) */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#151110] p-5 shadow-xs space-y-3 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white flex items-center gap-2">
                      Revenue Trajectory
                      <span className="h-2 w-2 rounded-full bg-[#754CFF] animate-pulse" />
                    </h3>
                    <p className="font-mono text-xs text-[#725039] dark:text-stone-400">
                      {tfData.subtitleRevenue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#754CFF]/15 dark:bg-[#754CFF]/25 border border-[#754CFF]/40 px-3 py-1 text-xs font-mono font-bold text-[#754CFF] dark:text-[#C4B5FD]">
                      {tfData.badgeRevenue}
                    </span>
                  </div>
                </div>

                {/* Spline Wave Canvas with Left Y-Axis */}
                <div className="relative h-48 w-full flex pt-3">
                  <div className="flex flex-col justify-between pr-2.5 py-1 text-[10px] font-mono text-[#8C6D53] dark:text-stone-400 select-none shrink-0 border-r border-[#C9AE8B]/30 dark:border-stone-800/80">
                    {tfData.yAxisLabels.map((lbl, idx) => (
                      <span key={idx}>{lbl}</span>
                    ))}
                  </div>

                  <div className="relative flex-1 h-full pl-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 520 130" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="purpleWaveGradAnalytics" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#754CFF" stopOpacity="0.55" />
                          <stop offset="40%" stopColor="#8B5CF6" stopOpacity="0.30" />
                          <stop offset="100%" stopColor="#151110" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="purpleGlowAnalytics" x="-10%" y="-10%" width="120%" height="120%">
                          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#754CFF" floodOpacity="0.4" />
                        </filter>
                      </defs>

                      <line x1="0" y1="10" x2="520" y2="10" stroke="#C9AE8B" strokeOpacity="0.15" strokeDasharray="3 3" />
                      <line x1="0" y1="50" x2="520" y2="50" stroke="#C9AE8B" strokeOpacity="0.15" strokeDasharray="3 3" />
                      <line x1="0" y1="90" x2="520" y2="90" stroke="#C9AE8B" strokeOpacity="0.15" strokeDasharray="3 3" />
                      <line x1="0" y1="125" x2="520" y2="125" stroke="#C9AE8B" strokeOpacity="0.25" />

                      {/* Golden Yellow Dashed Baseline */}
                      <path
                        d={tfData.curveYellow}
                        fill="none"
                        stroke="#F2C84B"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        className="opacity-90 dark:opacity-95"
                      />

                      {/* Electric Purple Area */}
                      <path
                        d={`${tfData.curvePurple} L 520,130 L 0,130 Z`}
                        fill="url(#purpleWaveGradAnalytics)"
                      />

                      {/* Electric Purple Stroke */}
                      <path
                        d={tfData.curvePurple}
                        fill="none"
                        stroke="#A855F7"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        filter="url(#purpleGlowAnalytics)"
                      />

                      <circle cx={tfData.peakX} cy={tfData.peakY} r="5" fill="#754CFF" stroke="#FFFFFF" strokeWidth="2.5" className="animate-pulse" />
                    </svg>
                  </div>
                </div>

                <div className="flex justify-between pl-8 pr-1 font-mono text-[10px] text-[#725039] dark:text-stone-400 pt-0.5 border-t border-[#C9AE8B]/20 dark:border-stone-800">
                  {tfData.xAxisLabels.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              </div>

              {/* Chart 3: Best-Selling Items (Real customer order aggregate) */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-xs space-y-3 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white">Best-Selling Items</h3>
                  <span className="font-mono text-xs text-[#8C6D53] dark:text-[#C9AE8B]">Live Customer Tally</span>
                </div>
                <div className="space-y-2.5 pt-2">
                  {(overviewData?.bestSellers || []).length > 0 ? (
                    (overviewData?.bestSellers || []).slice(0, 5).map((item, i) => {
                      const colors = ["#B72E35", "#D97706", "#319795", "#8C6D53", "#754CFF"];
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-[#241F1C] dark:text-stone-200">{item.name}</span>
                            <span className="font-mono text-[#725039] dark:text-stone-400">{item.sales} sold · {item.rev}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#EBDDC8] dark:bg-stone-800 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: colors[i % colors.length] }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs font-mono text-[#725039] dark:text-stone-400">
                      No customer items sold yet
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 4: Table Utilization & Payment Methods (Live customer state) */}
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-xs space-y-4 transition-colors">
                {(() => {
                  const actualTables =
                    overviewData?.tables && overviewData.tables.length > 0
                      ? overviewData.tables
                      : [{ id: "t-01", label: "01", seats: 2, isActive: true }];

                  const activeTableCount = actualTables.filter((t) => {
                    return orders.some(
                      (o) =>
                        (o.tableLabel === t.label ||
                          o.tableLabel === t.label.padStart(2, "0") ||
                          o.tableLabel.toLowerCase() === t.label.toLowerCase()) &&
                        o.status !== "COMPLETED" &&
                        o.status !== "CANCELLED" &&
                        o.status !== "REJECTED"
                    );
                  }).length;

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white">Table Utilization</h3>
                        <span className="font-mono text-xs text-[#B72E35] dark:text-[#F2C84B]">
                          {activeTableCount} / {actualTables.length} Active ({actualTables.length > 0 ? Math.round((activeTableCount / actualTables.length) * 100) : 0}%)
                        </span>
                      </div>
                      <div className={`grid gap-2 pt-1 ${actualTables.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : actualTables.length <= 8 ? "grid-cols-4" : "grid-cols-6"}`}>
                        {actualTables.map((t) => {
                          const isOccupied = orders.some(
                            (o) =>
                              (o.tableLabel === t.label ||
                                o.tableLabel === t.label.padStart(2, "0") ||
                                o.tableLabel.toLowerCase() === t.label.toLowerCase()) &&
                              o.status !== "COMPLETED" &&
                              o.status !== "CANCELLED" &&
                              o.status !== "REJECTED"
                          );
                          const displayLabel = t.label.toUpperCase().startsWith("T")
                            ? t.label.toUpperCase()
                            : isNaN(Number(t.label))
                            ? t.label
                            : `T${t.label}`;

                          return (
                            <div
                              key={t.id}
                              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center font-mono text-xs ${
                                isOccupied
                                  ? "border-[#B72E35] bg-[#B72E35]/10 dark:bg-[#B72E35]/20 text-[#B72E35] dark:text-[#F2C84B] font-bold"
                                  : "border-[#C9AE8B]/30 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900 text-[#725039] dark:text-stone-500"
                              }`}
                            >
                              <span className="font-bold truncate max-w-full">{displayLabel}</span>
                              <span className="text-[9px]">{isOccupied ? "Busy" : "Free"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-[#C9AE8B]/30 dark:border-stone-800 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-serif text-base font-bold text-[#241F1C] dark:text-white">Payment Methods</h3>
                    <span className="font-mono text-xs text-[#319795] dark:text-[#75AFA7]">
                      {overviewData?.paymentSplit?.[0]?.mode || "UPI Direct QR"} Dominant
                    </span>
                  </div>
                  <div className="flex h-3 w-full rounded-full overflow-hidden">
                    {(overviewData?.paymentSplit || []).map((ps, idx) => (
                      <div
                        key={idx}
                        style={{ width: ps.pct, backgroundColor: ps.color }}
                        title={`${ps.mode} (${ps.pct})`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-[#725039] dark:text-stone-400 mt-2 gap-1">
                    {(overviewData?.paymentSplit || []).map((ps, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ps.color }} />
                        {ps.mode} {ps.pct}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        </div>
      )}
    </main>

      {/* Floating Glassmorphic 3D Mobile Bottom Navbar (Thin & Adaptive) */}
      <div
        suppressHydrationWarning
        className="fixed bottom-2.5 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-40 md:hidden pointer-events-none"
      >
        <div className="pointer-events-auto rounded-full border border-[#D5C2AA]/80 dark:border-stone-800 bg-[#FAF4EB]/95 dark:bg-[#141010]/95 backdrop-blur-2xl shadow-[0_8px_24px_rgba(114,80,57,0.12),0_1px_4px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] px-3 pt-2 pb-1.5 transition-all">
          <nav className="flex items-center gap-2.5 overflow-x-auto scrollbar-none px-1 py-0.5 justify-start">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex flex-col items-center gap-1 shrink-0 group relative focus:outline-none cursor-pointer select-none px-1"
                >
                  {/* 3D Icon Puck / Circle */}
                  <div
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-b from-[#DC2626] to-[#B72E35] text-white shadow-[0_2.5px_6px_rgba(183,46,53,0.35),0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.6)] scale-[1.03]"
                        : "bg-gradient-to-b from-white to-[#EDE4D8] text-[#725039] border border-[#D9C4AC]/80 shadow-[0_1.5px_3px_rgba(114,80,57,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:brightness-95 dark:from-stone-800 dark:to-stone-900 dark:text-stone-300 dark:border-stone-700/60 dark:shadow-[0_1.5px_4px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] dark:hover:brightness-110"
                    }`}
                  >
                    <Icon className="h-4 w-4 stroke-[2]" />

                    {/* 3D Floating Badge */}
                    {item.badge && (
                      <span
                        className={`absolute -top-1 -right-1 flex h-3.5 min-w-[15px] items-center justify-center rounded-full px-1 text-[8px] font-bold font-mono ${
                          item.id === "orders"
                            ? "bg-[#DC2626] text-white shadow-[0_1.5px_3px_rgba(220,38,38,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                            : "bg-[#F3E7D3] text-[#725039] border border-[#C9AE8B]/70 shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {/* 3D Text Label */}
                  <span
                    className={`text-[10px] tracking-tight transition-all duration-200 ${
                      isActive
                        ? "font-bold text-[#B72E35] dark:text-white"
                        : "font-medium text-[#725039] group-hover:text-[#241F1C] dark:text-stone-400 dark:group-hover:text-stone-200"
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Clean Smooth Active Indicator Bar */}
                  <div className="flex items-center justify-center h-1 mt-0.5">
                    {isActive ? (
                      <span className="h-[2.5px] w-5 rounded-full bg-[#B72E35] dark:bg-red-500 shadow-[0_0_6px_rgba(183,46,53,0.35)] dark:shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    ) : (
                      <span className="h-[2.5px] w-5 opacity-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* iOS Bottom Home Bar */}
          <div className="w-16 sm:w-20 h-0.5 bg-[#725039]/20 dark:bg-white/20 rounded-full mx-auto mt-0.5" />
        </div>
      </div>

      {/* Order & POS Details Inspector Modal */}
      {(inspectingOrder || inspectingTag) && (
        <OrderDetailsInspectorModal
          order={inspectingOrder}
          tag={inspectingTag}
          onClose={() => {
            setInspectingOrder(null);
            setInspectingTag(null);
          }}
          onUpdateStatus={handleStatusChange}
        />
      )}

      {/* Role PIN / Password Edit Modal */}
      {mounted && editingRole && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#B72E35]/15 text-[#B72E35]">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                    Edit Quick PIN
                  </h3>
                  <p className="text-[11px] font-mono text-[#725039] dark:text-stone-400">
                    {editingRole.roleName} ({editingRole.portal})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRole(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white p-1 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRolePin} className="space-y-4">
              {/* Quick PIN Input */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1.5 flex items-center justify-between">
                  <span>Quick Access PIN (4-6 Digits)</span>
                  <button
                    type="button"
                    onClick={() => setShowPinMask(!showPinMask)}
                    className="text-[11px] font-mono text-[#B72E35] flex items-center gap-1 hover:underline"
                  >
                    {showPinMask ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showPinMask ? "Hide" : "Show"}</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showPinMask ? "text" : "password"}
                    required
                    maxLength={10}
                    value={editPinValue}
                    onChange={(e) => setEditPinValue(e.target.value)}
                    placeholder="e.g. 9900, 4422, 1234"
                    className="w-full rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-lg font-mono font-bold tracking-widest text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35] shadow-xs"
                  />
                </div>
              </div>

              {/* Preset Quick Chips */}
              <div>
                <span className="block text-[10.5px] font-mono text-stone-500 mb-1.5">
                  Quick PIN Suggestions:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["0000", "1234", "4422", "7711", "9900", "8888"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditPinValue(preset)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition ${
                        editPinValue === preset
                          ? "bg-[#B72E35] text-white border-[#B72E35]"
                          : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-[#C9AE8B]/40 dark:border-stone-700 hover:bg-[#F3E7D3]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Password Input for Super Admin */}
              {editingRole.role === "admin" && (
                <div>
                  <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1.5">
                    Master Password (Optional)
                  </label>
                  <input
                    type="text"
                    value={editPasswordValue}
                    onChange={(e) => setEditPasswordValue(e.target.value)}
                    placeholder="e.g. smol2026"
                    className="w-full rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2.5 text-sm font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35] shadow-xs"
                  />
                  <p className="text-[10px] font-mono text-stone-500 mt-1">
                    Allows logging into the Owner Control Tower with alphanumeric password.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#C9AE8B]/30 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => handleResetRolePin(editingRole.role)}
                  className="flex items-center gap-1 text-xs font-mono text-stone-500 hover:text-[#B72E35] transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset to Default</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="rounded-xl px-4 py-2 text-xs font-mono text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={pinUpdating}
                    className="flex items-center gap-1.5 rounded-xl bg-[#B72E35] hover:bg-[#9B252B] px-5 py-2 text-xs font-mono font-bold text-white shadow-md transition disabled:opacity-50"
                  >
                    {pinUpdating ? "Saving..." : "Save New PIN"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Adjust Customer Loyalty Points Modal */}
      {mounted && adjustPointsModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#C9AE8B] dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#B72E35] dark:text-[#F2C84B]" />
                  Adjust Patron Points
                </h3>
                <p className="font-mono text-xs text-[#725039] dark:text-[#C9AE8B]">
                  {adjustPointsModal.member.displayName} ({adjustPointsModal.member.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustPointsModal(null)}
                className="rounded-full p-1.5 text-stone-500 hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGrantPointsSubmit} className="space-y-4 pt-4">
              <div className="rounded-2xl bg-[#F3E7D3] dark:bg-stone-900 p-3 flex justify-between items-center text-xs font-mono">
                <span className="text-[#725039] dark:text-stone-400">Current Balance:</span>
                <span className="font-bold text-[#B72E35] dark:text-[#F2C84B] text-sm">
                  {adjustPointsModal.member.currentBalance} pts (₹{adjustPointsModal.member.currentBalance})
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1.5">
                  Points Delta (Use negative to deduct)
                </label>
                <div className="flex items-center gap-2">
                  {[-50, -20, +10, +25, +50, +100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setAdjustPointsModal({
                          ...adjustPointsModal,
                          pointsDelta: preset,
                        })
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition ${
                        adjustPointsModal.pointsDelta === preset
                          ? "bg-[#B72E35] text-white border-[#B72E35]"
                          : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-[#C9AE8B]/40 dark:border-stone-700 hover:bg-[#F3E7D3]"
                      }`}
                    >
                      {preset > 0 ? `+${preset}` : preset}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="number"
                    value={adjustPointsModal.pointsDelta}
                    onChange={(e) =>
                      setAdjustPointsModal({
                        ...adjustPointsModal,
                        pointsDelta: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2.5 text-sm font-mono font-bold text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                  />
                  <span className="font-mono text-xs font-bold text-[#725039]">pts</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1.5">
                  Audit Reason / Note
                </label>
                <input
                  type="text"
                  value={adjustPointsModal.reason}
                  onChange={(e) =>
                    setAdjustPointsModal({
                      ...adjustPointsModal,
                      reason: e.target.value,
                    })
                  }
                  placeholder="e.g. Birthday gift, Courtesy resolution, Festival bonus"
                  className="w-full rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2.5 text-xs font-sans text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#C9AE8B]/30 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setAdjustPointsModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-mono text-stone-600 dark:text-stone-400 hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="rounded-xl bg-[#B72E35] hover:bg-[#9E252C] px-5 py-2 text-xs font-serif font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {adjustSubmitting ? "Updating..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Digital Receipt View & Print Modal */}
      {activeReceipt && (
        <DigitalReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
};
