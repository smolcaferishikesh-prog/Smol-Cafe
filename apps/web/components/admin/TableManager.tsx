"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Armchair,
  Plus,
  Edit2,
  Trash2,
  QrCode,
  Tag,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Users,
  ExternalLink,
  Printer,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Download,
  Copy,
  Check,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  type DiningTableRecord,
  createTableAction,
  updateTableAction,
  deleteTableAction,
  createSectionAction,
  deleteSectionAction,
  fetchTablesAndSectionsAction,
} from "@/app/admin/tables/actions";
import { JsonTagInspectorModal } from "@/components/table/JsonTagInspectorModal";
import { createTableJsonTag, type TableJsonTag } from "@/lib/table-tag";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";

export const DEFAULT_QR_DOMAIN = "https://www.smolcafe.in";

export function getTableZoneSlug(section?: string): string {
  if (!section || !section.trim()) return "smol-cafe";
  return (
    section
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "smol-cafe"
  );
}

export function getTableUrl(originUrl?: string, section?: string, label?: string): string {
  const origin = (originUrl || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_QR_DOMAIN).replace(/\/$/, "");
  const zoneSlug = getTableZoneSlug(section);
  const cleanLabel = (label || "").trim().toLowerCase().replace(/^(table|t)[-\s_]*/i, "");
  const formattedNumber = cleanLabel.match(/^\d+$/) ? cleanLabel.padStart(2, "0") : cleanLabel;
  return `${origin}/${zoneSlug}/table-${formattedNumber || "01"}`;
}
function printHtmlContent(htmlContent: string, title: string) {
  if (typeof window === "undefined") return;

  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.style.visibility = "hidden";
  document.body.appendChild(printFrame);

  const doc = printFrame.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Inter:wght@400;500;600;700;900&family=Noto+Sans+Mono:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: auto;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #ffffff !important;
            color: #241F1C;
            padding: 10px;
          }
          .font-serif {
            font-family: 'EB Garamond', Georgia, serif;
          }
          .font-mono {
            font-family: 'Noto Sans Mono', monospace;
          }
          .card-container {
            width: 310px;
            margin: 15px auto;
            border: 2px solid #241F1C;
            border-radius: 22px;
            padding: 18px 16px;
            text-align: center;
            background: #ffffff;
            box-shadow: none;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .grid-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            width: 100%;
          }
          .batch-card {
            border: 2px solid #241F1C;
            border-radius: 18px;
            padding: 14px 12px;
            text-align: center;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          .logo {
            height: 44px;
            object-fit: contain;
            margin: 0 auto 3px auto;
            display: block;
          }
          .table-pill {
            display: inline-block;
            background: #241F1C;
            color: #FAF4EB;
            padding: 4px 16px;
            border-radius: 12px;
            margin: 6px 0 3px 0;
          }
          .qr-box {
            width: 180px;
            height: 180px;
            margin: 8px auto;
            padding: 6px;
            border: 1px solid #d6d3d1;
            border-radius: 14px;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .tagline {
            font-size: 12px;
            font-weight: 700;
            color: #241F1C;
            margin-top: 4px;
          }
          .subtag {
            font-size: 9px;
            color: #78716c;
            font-family: 'Noto Sans Mono', monospace;
          }
          .footer-info {
            border-top: 1px solid #e7e5e4;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 8.5px;
            font-family: 'Noto Sans Mono', monospace;
            color: #78716c;
          }
          .footer-url {
            color: #B72E35;
            font-weight: 700;
            margin-bottom: 2px;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } catch (e) {
      console.error("Print error:", e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 3000);
    }
  }, 350);
}

interface TableManagerProps {
  initialTables?: DiningTableRecord[];
  initialSections?: string[];
}

export const TableManager: React.FC<TableManagerProps> = ({
  initialTables = [],
  initialSections = [],
}) => {
  const [tables, setTables] = useState<DiningTableRecord[]>(initialTables);
  const [sections, setSections] = useState<string[]>(
    initialSections.length > 0
      ? initialSections
      : ["smol-cafe", "smol-lounge", "smol-terrace"]
  );
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshTables = React.useCallback(async () => {
    try {
      const res = await fetchTablesAndSectionsAction();
      if (res.success && res.tables) {
        setTables(res.tables);
        if (res.sections && res.sections.length > 0) {
          setSections(res.sections);
        }
      }
    } catch {
      // ignore network errors
    }
  }, []);

  React.useEffect(() => {
    if (initialTables && initialTables.length > 0) {
      setTables((prev) => {
        if (prev.length === 0) return initialTables;
        const seen = new Set<string>();
        const merged: DiningTableRecord[] = [];
        const idMap = new Map<string, DiningTableRecord>();
        initialTables.forEach((t) => idMap.set(t.label.trim().toLowerCase(), t));
        prev.forEach((t) => {
          const norm = t.label.trim().toLowerCase();
          const serverVersion = idMap.get(norm);
          if (!seen.has(norm)) {
            seen.add(norm);
            merged.push(serverVersion ? { ...t, ...serverVersion } : t);
          }
        });
        initialTables.forEach((t) => {
          const norm = t.label.trim().toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            merged.push(t);
          }
        });
        return merged;
      });
    } else {
      refreshTables();
    }
  }, [initialTables, refreshTables]);

  // Real-time synchronization across all devices and open tabs for Dining Tables
  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((event) => {
      if (event.type === "TABLE_CREATED") {
        const meta = event.metadata || {};
        const label = event.tableLabel || (meta.label as string) || "";
        const id = event.tableId || (meta.id as string) || `tbl_${Date.now()}`;
        const section = (meta.section as string) || "smol-cafe";
        const seats = Number(meta.seats) || 2;
        const active = meta.active !== undefined ? Boolean(meta.active) : true;

        setTables((prev) => {
          const normLabel = label.trim().toLowerCase();
          const matchIdx = prev.findIndex(
            (t) => t.id === id || (normLabel && t.label.trim().toLowerCase() === normLabel)
          );

          if (matchIdx >= 0) {
            return prev.map((t, idx) =>
              idx === matchIdx
                ? { ...t, id: id || t.id, label: label || t.label, section, seats, active }
                : t
            );
          }

          return [
            ...prev,
            {
              id,
              location_id: (meta.location_id as string) || "",
              label,
              seats,
              active,
              section,
              isOccupied: false,
            },
          ];
        });

        if (section) {
          setSections((prev) => (prev.includes(section) ? prev : [...prev, section]));
        }
      } else if (event.type === "TABLE_RENAMED") {
        const meta = event.metadata || {};
        const id = event.tableId || (meta.id as string);
        const label = event.tableLabel || (meta.label as string);
        const normLabel = (label || "").trim().toLowerCase();

        setTables((prev) => {
          const seen = new Set<string>();
          return prev
            .map((t) => {
              const isMatch =
                (id && t.id === id) ||
                (normLabel && t.label.trim().toLowerCase() === normLabel);
              if (isMatch) {
                return {
                  ...t,
                  id: id || t.id,
                  label: label || t.label,
                  seats: meta.seats !== undefined ? Number(meta.seats) : t.seats,
                  active: meta.active !== undefined ? Boolean(meta.active) : t.active,
                  section: (meta.section as string) || t.section,
                  isOccupied: meta.isOccupied !== undefined ? Boolean(meta.isOccupied) : t.isOccupied,
                };
              }
              return t;
            })
            .filter((t) => {
              const norm = t.label.trim().toLowerCase();
              if (seen.has(norm)) return false;
              seen.add(norm);
              return true;
            });
        });

        if (meta.section && typeof meta.section === "string") {
          const sec = meta.section;
          setSections((prev) => (prev.includes(sec) ? prev : [...prev, sec]));
        }
      } else if (event.type === "TABLE_DELETED") {
        const targetId = event.tableId || (event.metadata?.id as string);
        const targetLabel = event.tableLabel || (event.metadata?.label as string);

        setTables((prev) =>
          prev.filter((t) => {
            if (targetId && t.id === targetId) return false;
            if (targetLabel && t.label.toLowerCase() === targetLabel.toLowerCase()) return false;
            return true;
          })
        );
      } else if (event.type === "SETTINGS_UPDATED") {
        const meta = event.metadata || {};
        if (meta.action === "SECTIONS_UPDATED" && Array.isArray(meta.sections)) {
          setSections(meta.sections as string[]);
        } else {
          refreshTables();
        }
      } else if (event.type === "STATUS_CHANGED" || event.type === "ORDER_PLACED") {
        refreshTables();
      }
    });

    return () => unsubscribe();
  }, [refreshTables]);

  // Fast fallback refresh when tab or network resumes
  useEffect(() => {
    const handleFocus = () => {
      refreshTables();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, [refreshTables]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<DiningTableRecord | null>(null);
  const [deletingTable, setDeletingTable] = useState<DiningTableRecord | null>(null);
  const [isSectionsModalOpen, setIsSectionsModalOpen] = useState<boolean>(false);
  const [inspectingTag, setInspectingTag] = useState<TableJsonTag | null>(null);
  const [viewingQrTable, setViewingQrTable] = useState<DiningTableRecord | null>(null);
  const [isBatchQrModalOpen, setIsBatchQrModalOpen] = useState<boolean>(false);

  // Custom Dropdown Open States
  const [isAddSectionDropdownOpen, setIsAddSectionDropdownOpen] = useState<boolean>(false);
  const [isEditSectionDropdownOpen, setIsEditSectionDropdownOpen] = useState<boolean>(false);

  // QR Generation States
  const [qrDomain, setQrDomain] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [addQrPreviewUrl, setAddQrPreviewUrl] = useState<string>("");
  const [allQrDataUrls, setAllQrDataUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<boolean>(false);

  // Form states
  const [tableLabel, setTableLabel] = useState<string>("");
  const [tableSection, setTableSection] = useState<string>(sections[0] || "Café");
  const [tableSeats, setTableSeats] = useState<number>(4);
  const [tableActive, setTableActive] = useState<boolean>(true);
  const [newSectionName, setNewSectionName] = useState<string>("");

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Auto-detect active host/origin on mount (defaults to official https://www.smolcafe.in)
  useEffect(() => {
    const activeOrigin = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_QR_DOMAIN;
    setQrDomain(activeOrigin);
  }, []);

  const handlePrintSingleStand = (table: DiningTableRecord, qrUrl: string, url: string) => {
    const tableUrl = url || getTableUrl(qrDomain, table.section, table.label);
    const content = `
      <div class="card-container">
        <div style="border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; margin-bottom: 8px;">
          <img src="/current_logo_transparent_on_cream.png" alt="smol café" class="logo" />
          <span style="font-size: 8.5px; font-family: 'Noto Sans Mono', monospace; letter-spacing: 2px; color: #78716c; text-transform: uppercase; font-weight: bold; display: block;">
            Tapovan, Rishikesh
          </span>
        </div>

        <div style="margin: 6px 0;">
          <div class="table-pill">
            <span style="font-size: 9.5px; font-family: 'Noto Sans Mono', monospace; letter-spacing: 2px; text-transform: uppercase; display: block; font-weight: bold;">
              SEATING TABLE
            </span>
            <span class="font-serif" style="font-size: 26px; font-weight: 900; line-height: 1; display: block;">
              ${table.label}
            </span>
          </div>
          <span style="display: block; font-size: 9.5px; font-family: 'Noto Sans Mono', monospace; color: #57534e; font-weight: bold; margin-top: 4px; text-transform: uppercase;">
            ${table.section}
          </span>
        </div>

        <div class="qr-box">
          <img src="${qrUrl}" alt="Table ${table.label} QR" />
        </div>

        <div>
          <p class="tagline font-serif">Scan to View Menu &amp; Order</p>
          <p class="subtag">Point your phone camera • No app download required</p>
        </div>

        <div class="footer-info">
          <div class="footer-url">${tableUrl.replace(/^https?:\/\//, "")}</div>
          <div>Wi-Fi: <strong style="color: #292524;">smol-guest</strong> | Pass: <strong style="color: #292524;">coffee123</strong></div>
        </div>
      </div>
    `;
    printHtmlContent(content, `Smol Cafe — Table ${table.label} QR Stand`);
  };

  const handlePrintAllStands = (originUrl: string) => {
    const cards = tables
      .map((table) => {
        const tableUrl = getTableUrl(originUrl, table.section, table.label);
        const qrUrl = allQrDataUrls[table.label] || "";
        return `
          <div class="batch-card">
            <div style="border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; margin-bottom: 6px;">
              <img src="/current_logo_transparent_on_cream.png" alt="smol café" class="logo" style="height: 38px;" />
              <span style="font-size: 7.5px; font-family: 'Noto Sans Mono', monospace; letter-spacing: 1.5px; color: #78716c; text-transform: uppercase; font-weight: bold; display: block;">
                Tapovan, Rishikesh
              </span>
            </div>

            <div style="margin: 4px 0;">
              <div class="table-pill" style="padding: 3px 12px;">
                <span style="font-size: 8.5px; font-family: 'Noto Sans Mono', monospace; letter-spacing: 1.5px; text-transform: uppercase; display: block; font-weight: bold;">
                  TABLE
                </span>
                <span class="font-serif" style="font-size: 22px; font-weight: 900; line-height: 1; display: block;">
                  ${table.label}
                </span>
              </div>
              <span style="display: block; font-size: 8.5px; font-family: 'Noto Sans Mono', monospace; color: #57534e; font-weight: bold; margin-top: 3px; text-transform: uppercase;">
                ${table.section} • ${table.seats} Seats
              </span>
            </div>

            <div class="qr-box" style="width: 145px; height: 145px; margin: 6px auto;">
              ${
                qrUrl
                  ? `<img src="${qrUrl}" alt="Table ${table.label} QR" />`
                  : `<div style="font-size: 10px; font-family: monospace; color: #a8a29e;">QR Loading...</div>`
              }
            </div>

            <div>
              <p class="tagline font-serif" style="font-size: 11.5px;">Scan to View Menu &amp; Order</p>
              <p class="subtag" style="font-size: 8px;">Point phone camera • Instant table menu</p>
            </div>

            <div class="footer-info">
              <div class="footer-url">${tableUrl.replace(/^https?:\/\//, "")}</div>
              <div>Wi-Fi: <strong style="color: #292524;">smol-guest</strong> | Pass: <strong style="color: #292524;">coffee123</strong></div>
            </div>
          </div>
        `;
      })
      .join("");

    const content = `
      <div class="grid-container">
        ${cards}
      </div>
    `;
    printHtmlContent(content, `Smol Cafe — All ${tables.length} Table Stands`);
  };

  // Real-time QR Generation for Add Table Modal preview
  useEffect(() => {
    if (isAddModalOpen && tableLabel.trim()) {
      const origin = qrDomain || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      const tableUrl = getTableUrl(origin, tableSection, tableLabel);
      QRCode.toDataURL(tableUrl, {
        width: 320,
        margin: 1,
        color: { dark: "#241F1C", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      })
        .then(setAddQrPreviewUrl)
        .catch(() => setAddQrPreviewUrl(""));
    } else {
      setAddQrPreviewUrl("");
    }
  }, [isAddModalOpen, tableLabel, tableSection, qrDomain]);

  // Real-time QR Generation for selected table
  useEffect(() => {
    if (viewingQrTable) {
      const origin = qrDomain || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      const tableUrl = getTableUrl(origin, viewingQrTable.section, viewingQrTable.label);
      QRCode.toDataURL(tableUrl, {
        width: 480,
        margin: 2,
        color: {
          dark: "#241F1C",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      })
        .then(setQrDataUrl)
        .catch(console.error);
    } else {
      setQrDataUrl("");
      setCopied(false);
    }
  }, [viewingQrTable, qrDomain]);

  // Batch QR Generation for all tables
  useEffect(() => {
    if (isBatchQrModalOpen && tables.length > 0) {
      const origin = qrDomain || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      const promises = tables.map(async (t) => {
        const tableUrl = getTableUrl(origin, t.section, t.label);
        const url = await QRCode.toDataURL(tableUrl, {
          width: 360,
          margin: 2,
          color: { dark: "#241F1C", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });
        return { label: t.label, url };
      });

      Promise.all(promises).then((results) => {
        const map: Record<string, string> = {};
        results.forEach((r) => {
          map[r.label] = r.url;
        });
        setAllQrDataUrls(map);
      });
    }
  }, [isBatchQrModalOpen, tables, qrDomain]);

  // Statistics
  const stats = useMemo(() => {
    const total = tables.length;
    const active = tables.filter((t) => t.active).length;
    const occupied = tables.filter((t) => t.isOccupied).length;
    const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
    return { total, active, occupied, totalSeats };
  }, [tables]);

  // Global Escape key listener to close all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingQrTable(null);
        setIsBatchQrModalOpen(false);
        setEditingTable(null);
        setIsAddModalOpen(false);
        setIsSectionsModalOpen(false);
        setInspectingTag(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Section table counts
  const sectionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    tables.forEach((t) => {
      map[t.section] = (map[t.section] || 0) + 1;
    });
    return map;
  }, [tables]);

  // Filtered tables with strict client-side deduplication
  const filteredTables = useMemo(() => {
    const seenLabels = new Set<string>();
    const seenIds = new Set<string>();
    const deduped: DiningTableRecord[] = [];

    for (const t of tables) {
      const normLabel = (t.label || "").trim().toLowerCase();
      if (seenIds.has(t.id) || (normLabel && seenLabels.has(normLabel))) {
        continue;
      }
      seenIds.add(t.id);
      if (normLabel) seenLabels.add(normLabel);
      deduped.push(t);
    }

    return deduped.filter((t) => {
      const matchSection = selectedSection === "ALL" || t.section === selectedSection;
      const matchSearch =
        !searchQuery.trim() ||
        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.section.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSection && matchSearch;
    });
  }, [tables, selectedSection, searchQuery]);

  // Section color accents
  const getSectionBadgeClass = (sec: string) => {
    switch (sec) {
      case "smol-cafe":
      case "Café":
      case "Cafe":
      case "Indoor Cozy":
        return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800";
      case "smol-lounge":
      case "Lounge":
        return "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800";
      case "smol-terrace":
      case "Terrace":
      case "Garden Terrace":
        return "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800";
      case "Courtyard Verandah":
        return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800";
      case "Brew Bar":
        return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800";
      default:
        return "bg-stone-100 text-stone-900 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700";
    }
  };

  // Open Add Table Modal
  const handleOpenAdd = () => {
    const nextNum = (tables.length + 1).toString().padStart(2, "0");
    setTableLabel(nextNum);
    setTableSection(sections[0] || "smol-cafe");
    setTableSeats(4);
    setTableActive(true);
    setFeedback(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Table Modal
  const handleOpenEdit = (t: DiningTableRecord) => {
    setEditingTable(t);
    setTableLabel(t.label);
    setTableSection(t.section || sections[0] || "smol-cafe");
    setTableSeats(t.seats || 2);
    setTableActive(t.active);
    setFeedback(null);
  };

  // Submit Add Table
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableLabel.trim()) {
      setFeedback({ type: "error", text: "Please enter a table label or number." });
      return;
    }
    setIsLoading(true);
    try {
      const res = await createTableAction({
        label: tableLabel.trim(),
        section: tableSection,
        seats: tableSeats,
        active: tableActive,
      });

      if (res.success && res.table) {
        const newTable = res.table;
        setTables((prev) => {
          const normLabel = newTable.label.trim().toLowerCase();
          const matchIdx = prev.findIndex(
            (t) => t.id === newTable.id || t.label.trim().toLowerCase() === normLabel
          );
          if (matchIdx >= 0) {
            return prev.map((t, idx) => (idx === matchIdx ? { ...t, ...newTable } : t));
          }
          return [...prev, newTable];
        });

        if (!sections.includes(tableSection)) {
          setSections((prev) => [...prev, tableSection]);
        }
        setIsAddModalOpen(false);
        setIsAddSectionDropdownOpen(false);
        setFeedback({ type: "success", text: `Table T-${res.table.label} added! Scannable QR stand & tags generated.` });
        // Automatically open the new Table's QR Stand for instant preview & printing!
        setViewingQrTable(res.table);
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to add table." });
      }
    } catch {
      setFeedback({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Edit Table
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    if (!tableLabel.trim()) {
      setFeedback({ type: "error", text: "Table label cannot be empty." });
      return;
    }
    setIsLoading(true);
    try {
      const res = await updateTableAction(editingTable.id, {
        label: tableLabel.trim(),
        section: tableSection,
        seats: tableSeats,
        active: tableActive,
      });

      if (res.success && res.table) {
        const updatedTable = res.table;
        setTables((prev) => {
          const seen = new Set<string>();
          return prev
            .map((t) =>
              t.id === editingTable.id || t.label.trim().toLowerCase() === editingTable.label.trim().toLowerCase()
                ? { ...t, ...updatedTable }
                : t
            )
            .filter((t) => {
              const norm = t.label.trim().toLowerCase();
              if (seen.has(norm)) return false;
              seen.add(norm);
              return true;
            });
        });
        if (!sections.includes(tableSection)) {
          setSections((prev) => [...prev, tableSection]);
        }
        setEditingTable(null);
        setFeedback({ type: "success", text: "Table updated successfully!" });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to update table." });
      }
    } catch {
      setFeedback({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Table Active inline
  const handleToggleActive = async (t: DiningTableRecord) => {
    const newStatus = !t.active;
    try {
      const res = await updateTableAction(t.id, { active: newStatus });
      if (res.success) {
        setTables((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, active: newStatus } : item))
        );
        broadcastSyncEvent({
          type: "TABLE_RENAMED",
          tableLabel: t.label,
          tableId: t.id,
          metadata: {
            id: t.id,
            label: t.label,
            active: newStatus,
            section: t.section,
            seats: t.seats,
          },
        });
      }
    } catch {
      // ignore
    }
  };

  // Delete Table
  const handleConfirmDelete = async () => {
    if (!deletingTable) return;
    setIsLoading(true);
    try {
      const res = await deleteTableAction(deletingTable.id);
      if (res.success) {
        setTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
        broadcastSyncEvent({
          type: "TABLE_DELETED",
          tableId: deletingTable.id,
          tableLabel: deletingTable.label,
          metadata: { id: deletingTable.id, label: deletingTable.label },
        });
        setDeletingTable(null);
        setFeedback({ type: "success", text: `Table ${deletingTable.label} deleted successfully.` });
      } else {
        setFeedback({ type: "error", text: res.message || "Could not delete table." });
      }
    } catch {
      setFeedback({ type: "error", text: "Error deleting table." });
    } finally {
      setIsLoading(false);
    }
  };

  // Add Section
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    setIsLoading(true);
    try {
      const res = await createSectionAction(newSectionName.trim());
      if (res.success && res.sections) {
        setSections(res.sections);
        setNewSectionName("");
        broadcastSyncEvent({
          type: "SETTINGS_UPDATED",
          metadata: { action: "SECTIONS_UPDATED", sections: res.sections },
        });
        setFeedback({ type: "success", text: res.message || "Section added!" });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to add section." });
      }
    } catch {
      setFeedback({ type: "error", text: "Error creating section." });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Section
  const handleDeleteSection = async (name: string) => {
    setIsLoading(true);
    try {
      const res = await deleteSectionAction(name);
      if (res.success && res.sections) {
        setSections(res.sections);
        if (selectedSection === name) setSelectedSection("ALL");
        broadcastSyncEvent({
          type: "SETTINGS_UPDATED",
          metadata: { action: "SECTIONS_UPDATED", sections: res.sections },
        });
        setFeedback({ type: "success", text: res.message || "Section removed." });
      } else {
        setFeedback({ type: "error", text: res.message || "Cannot remove section." });
      }
    } catch {
      setFeedback({ type: "error", text: "Error removing section." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none">
      {/* Main Admin Dashboard Content (Hidden Completely When Printing QR Stands) */}
      <div className="print:hidden space-y-4 sm:space-y-6">
        {/* Feedback Toast */}
        {feedback && (
          <div
            className={`flex items-center justify-between rounded-2xl p-4 text-xs font-mono transition-all border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Header & Quick Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-white">
                Dining Tables &amp; Floor Sections
              </h1>
              <span className="rounded-full bg-[#B72E35]/15 dark:bg-[#B72E35]/30 text-[#B72E35] dark:text-[#FF6B6B] px-2.5 py-0.5 text-xs font-mono font-bold shrink-0">
                {tables.length} Tables
              </span>
            </div>
            <p className="font-mono text-xs text-[#725039] dark:text-stone-400 mt-0.5">
              Add, edit, and organize dining tables into zones with QR code &amp; JSON Tag generation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setIsBatchQrModalOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-900 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-mono font-bold text-[#241F1C] dark:text-white hover:bg-[#F3E7D3] dark:hover:bg-stone-800 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
              <span>Print All QRs ({tables.length})</span>
            </button>

            <button
              onClick={() => setIsSectionsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-900 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-mono font-bold text-[#241F1C] dark:text-white hover:bg-[#F3E7D3] dark:hover:bg-stone-800 transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-[#754CFF] dark:text-[#C4B5FD]" />
              <span>Manage Sections</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 rounded-2xl bg-[#B72E35] hover:bg-[#9B252B] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-mono font-bold text-white shadow-md shadow-red-950/20 active:scale-95 transition whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Table</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1815] p-3 sm:p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] sm:text-[11px] font-mono uppercase text-[#725039] dark:text-stone-400">Total Tables</span>
              <Armchair className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-serif font-bold text-[#241F1C] dark:text-white">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1815] p-3 sm:p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] sm:text-[11px] font-mono uppercase text-[#725039] dark:text-stone-400">Occupied</span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400 truncate">
              {stats.occupied} <span className="text-xs font-mono font-normal text-stone-500">active</span>
            </p>
          </div>

          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1815] p-3 sm:p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] sm:text-[11px] font-mono uppercase text-[#725039] dark:text-stone-400">Total Capacity</span>
              <Users className="h-4 w-4 text-[#725039] dark:text-stone-400" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-serif font-bold text-[#241F1C] dark:text-white truncate">
              {stats.totalSeats} <span className="text-xs font-mono font-normal text-stone-500">seats</span>
            </p>
          </div>

          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1815] p-3 sm:p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] sm:text-[11px] font-mono uppercase text-[#725039] dark:text-stone-400">Floor Sections</span>
              <Layers className="h-4 w-4 text-[#754CFF]" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-serif font-bold text-[#241F1C] dark:text-white">{sections.length}</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
          {/* Section Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 min-w-0">
            <button
              onClick={() => setSelectedSection("ALL")}
              className={`shrink-0 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer ${
                selectedSection === "ALL"
                  ? "bg-[#241F1C] text-white dark:bg-white dark:text-[#241F1C] shadow-xs"
                  : "bg-[#FAF4EB] text-[#725039] border border-[#C9AE8B]/40 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800 hover:bg-[#F3E7D3]"
              }`}
            >
              All Sections ({tables.length})
            </button>

            {sections.map((sec) => {
              const count = sectionCounts[sec] || 0;
              return (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`shrink-0 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer ${
                    selectedSection === sec
                      ? "bg-[#B72E35] text-white shadow-xs"
                      : "bg-[#FAF4EB] text-[#725039] border border-[#C9AE8B]/40 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800 hover:bg-[#F3E7D3]"
                  }`}
                >
                  {sec} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-60 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or section..."
              className="w-full rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-900 pl-9 pr-3 py-1.5 text-xs font-mono text-[#241F1C] dark:text-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B72E35]"
            />
          </div>
        </div>

        {/* Tables Floor Grid */}
        {filteredTables.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-[#C9AE8B]/50 dark:border-stone-800 bg-[#FAF4EB]/40 dark:bg-stone-900/40 p-6">
            <Armchair className="h-10 w-10 text-stone-400 mx-auto mb-2 opacity-50" />
            <p className="font-serif text-base font-bold text-[#241F1C] dark:text-white">No Tables Found</p>
            <p className="font-mono text-xs text-stone-500 mt-1">
              {searchQuery
                ? `No tables match "${searchQuery}". Try another search.`
                : `No tables currently assigned to "${selectedSection}".`}
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#B72E35] px-3.5 py-1.5 text-xs font-mono text-white font-bold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Table to This Section</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredTables.map((t) => {
            const cleanNum = t.label.padStart(2, "0");
            const isOcc = t.isOccupied;

            return (
              <div
                key={t.id}
                className={`rounded-3xl border p-4 transition-all relative flex flex-col justify-between shadow-xs bg-[#FAF4EB] dark:bg-[#1A1715] ${
                  !t.active
                    ? "opacity-60 border-stone-300 dark:border-stone-800 grayscale"
                    : isOcc
                    ? "border-[#B72E35] shadow-md ring-1 ring-[#B72E35]/40"
                    : "border-[#C9AE8B]/40 dark:border-stone-800 hover:border-[#C9AE8B]"
                }`}
              >
                {/* Card Top: Number, Section & Occupancy */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-black text-[#241F1C] dark:text-white">
                          T-{t.label}
                        </span>
                        {!t.active && (
                          <span className="text-[9px] font-mono uppercase bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-1.5 py-0.5 rounded-md">
                            Disabled
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-block mt-1 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full border ${getSectionBadgeClass(
                          t.section
                        )}`}
                      >
                        {t.section}
                      </span>
                    </div>

                    {/* Status Dot / Toggle */}
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isOcc
                              ? "bg-emerald-500 animate-pulse"
                              : t.active
                              ? "bg-stone-400 dark:bg-stone-600"
                              : "bg-stone-300 dark:bg-stone-800"
                          }`}
                        />
                        <span className="text-[10px] font-mono text-stone-500">
                          {isOcc ? "Occupied" : t.active ? "Available" : "Off"}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleActive(t)}
                        title={t.active ? "Disable Table" : "Enable Table"}
                        className="text-stone-400 hover:text-[#B72E35] transition"
                      >
                        {t.active ? (
                          <ToggleRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-stone-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Seat Info */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#725039] dark:text-stone-400 font-mono">
                    <Users className="h-3.5 w-3.5" />
                    <span>{t.seats} Guests Seating</span>
                  </div>
                </div>

                {/* Card Bottom: Quick Actions */}
                <div className="space-y-1.5 pt-4 border-t border-[#C9AE8B]/20 dark:border-stone-800/80 mt-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setViewingQrTable(t)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-[#F3E7D3] dark:bg-stone-800 py-1.5 text-[11px] font-mono font-semibold text-[#241F1C] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 transition"
                    >
                      <QrCode className="h-3 w-3 text-[#B72E35] dark:text-[#F2C84B]" />
                      <span>View QR</span>
                    </button>

                    <button
                      onClick={() => setInspectingTag(createTableJsonTag(cleanNum))}
                      className="flex items-center justify-center gap-1 rounded-xl bg-[#F3E7D3] dark:bg-stone-800 py-1.5 text-[11px] font-mono font-semibold text-[#241F1C] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 transition"
                    >
                      <Tag className="h-3 w-3 text-[#754CFF]" />
                      <span>JSON Tag</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-white dark:bg-stone-900 py-1.5 text-[11px] font-mono font-bold text-[#725039] dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
                    >
                      <Edit2 className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeletingTable(t)}
                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/70 transition"
                      title="Delete Table"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Table Quick Card in Grid */}
          <button
            onClick={handleOpenAdd}
            type="button"
            className="flex flex-col items-center justify-center min-h-[260px] rounded-3xl border-2 border-dashed border-[#C9AE8B]/60 dark:border-stone-700 hover:border-[#B72E35] dark:hover:border-[#B72E35] bg-[#FAF4EB]/50 dark:bg-[#1A1715]/40 hover:bg-[#FAF4EB] dark:hover:bg-[#1A1715] p-6 text-center transition group shadow-xs hover:shadow-md cursor-pointer"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B72E35]/10 text-[#B72E35] group-hover:bg-[#B72E35] group-hover:text-white transition-all duration-300 group-hover:scale-110 shadow-xs mb-3">
              <Plus className="h-7 w-7" />
            </div>
            <h4 className="font-serif text-base font-bold text-[#241F1C] dark:text-white group-hover:text-[#B72E35] transition">
              + Add New Table
            </h4>
            <p className="text-xs font-mono text-stone-500 mt-1 max-w-[180px]">
              Create table, auto-generate QR code & customer tag instantly
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#B72E35] bg-[#B72E35]/10 px-3 py-1 rounded-full group-hover:bg-[#B72E35] group-hover:text-white transition">
              <QrCode className="h-3 w-3" /> Auto QR Ready
            </span>
          </button>
        </div>
      )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD TABLE                                                        */}
      {/* ========================================================================= */}
      {mounted && isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#B72E35]/15 text-[#B72E35]">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">Add New Table</h3>
                  <p className="text-[11px] font-mono text-stone-500">Configure floor location and seating</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                  Table Number / Label
                </label>
                <input
                  type="text"
                  required
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  placeholder="e.g. 13, 14, Verandah-A"
                  className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                />
              </div>

              {/* Floor Section / Zone - Custom Aesthetic Café Selector */}
              <div className="relative">
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1.5 flex items-center justify-between">
                  <span>Floor Section / Zone</span>
                  <span className="text-[10.5px] font-normal text-stone-500">Tap to select zone</span>
                </label>

                {/* Custom Dropdown Trigger */}
                <button
                  type="button"
                  onClick={() => setIsAddSectionDropdownOpen(!isAddSectionDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-left text-sm font-mono text-[#241F1C] dark:text-white hover:border-[#B72E35] focus:outline-none focus:ring-2 focus:ring-[#B72E35] shadow-xs transition"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getSectionBadgeClass(
                        tableSection
                      )}`}
                    >
                      {tableSection}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${
                      isAddSectionDropdownOpen ? "rotate-180 text-[#B72E35]" : ""
                    }`}
                  />
                </button>

                {/* Custom Dropdown Menu Popover */}
                {isAddSectionDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsAddSectionDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-30 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1C1816] p-2 shadow-xl space-y-1 animate-scale-in max-h-52 overflow-y-auto">
                      {sections.map((sec) => {
                        const isSelected = tableSection === sec;
                        const count = tables.filter((t) => t.section === sec).length;

                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              setTableSection(sec);
                              setIsAddSectionDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-mono transition text-left ${
                              isSelected
                                ? "bg-[#F3E7D3] dark:bg-stone-800 font-bold text-[#241F1C] dark:text-white border border-[#C9AE8B]/50 dark:border-stone-600 shadow-xs"
                                : "text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-800/60"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getSectionBadgeClass(
                                  sec
                                )}`}
                              >
                                {sec}
                              </span>
                              <span className="text-[10.5px] text-stone-400">({count} tables)</span>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Quick Pill Badges for 1-click selection */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {sections.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setTableSection(sec);
                        setIsAddSectionDropdownOpen(false);
                      }}
                      className={`text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-xl border transition ${
                        tableSection === sec
                          ? "bg-[#B72E35] text-white border-[#B72E35] shadow-xs"
                          : "bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 border-[#C9AE8B]/40 dark:border-stone-700 hover:bg-[#F3E7D3]"
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                  Seating Capacity (Guests)
                </label>
                <div className="flex items-center gap-2">
                  {[2, 4, 6, 8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTableSeats(s)}
                      className={`flex-1 rounded-xl py-1.5 text-xs font-mono font-bold border transition ${
                        tableSeats === s
                          ? "bg-[#B72E35] text-white border-[#B72E35] shadow-xs"
                          : "bg-white dark:bg-stone-900 text-[#725039] dark:text-stone-400 border-[#C9AE8B]/40 dark:border-stone-700 hover:bg-[#F3E7D3]"
                      }`}
                    >
                      {s} seats
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F3E7D3]/60 dark:bg-stone-900/60 p-3 border border-[#C9AE8B]/30 dark:border-stone-800">
                <div>
                  <span className="block text-xs font-mono font-bold text-[#241F1C] dark:text-white">Active Status</span>
                  <span className="text-[10.5px] font-mono text-stone-500">Available for customer QR scans</span>
                </div>
                <input
                  type="checkbox"
                  checked={tableActive}
                  onChange={(e) => setTableActive(e.target.checked)}
                  className="h-5 w-5 accent-[#B72E35] cursor-pointer"
                />
              </div>

              {/* Real-time QR Preview Card */}
              {tableLabel.trim() && (
                <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/40 dark:bg-stone-900/60 p-3 flex items-center gap-3.5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-[#C9AE8B]/40 shadow-xs">
                    {addQrPreviewUrl ? (
                      <img src={addQrPreviewUrl} alt="Live QR Preview" className="h-full w-full object-contain" />
                    ) : (
                      <QrCode className="h-8 w-8 text-stone-400 animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#B72E35]" />
                      <span className="text-[11px] font-mono font-bold text-[#241F1C] dark:text-white uppercase tracking-wider">
                        Auto QR Ready
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-[#725039] dark:text-stone-300 truncate mt-0.5">
                      {getTableUrl(qrDomain || DEFAULT_QR_DOMAIN, tableSection, tableLabel)}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      Stand card, print sheet & token generated automatically on save.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#C9AE8B]/20 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsAddSectionDropdownOpen(false);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-mono text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-[#B72E35] hover:bg-[#9B252B] px-5 py-2 text-xs font-mono font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isLoading ? "Adding Table..." : "Add Table"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT TABLE                                                       */}
      {/* ========================================================================= */}
      {mounted && editingTable && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                    Edit Table T-{editingTable.label}
                  </h3>
                  <p className="text-[11px] font-mono text-stone-500">Update table configuration & seating</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingTable(null);
                  setIsEditSectionDropdownOpen(false);
                }}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                  Table Number / Label
                </label>
                <input
                  type="text"
                  required
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                />
              </div>

              {/* Floor Section / Zone - Custom Aesthetic Café Selector */}
              <div className="relative">
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1.5 flex items-center justify-between">
                  <span>Floor Section / Zone</span>
                  <span className="text-[10.5px] font-normal text-stone-500">Tap to select zone</span>
                </label>

                {/* Custom Dropdown Trigger */}
                <button
                  type="button"
                  onClick={() => setIsEditSectionDropdownOpen(!isEditSectionDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-left text-sm font-mono text-[#241F1C] dark:text-white hover:border-[#B72E35] focus:outline-none focus:ring-2 focus:ring-[#B72E35] shadow-xs transition"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getSectionBadgeClass(
                        tableSection
                      )}`}
                    >
                      {tableSection}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${
                      isEditSectionDropdownOpen ? "rotate-180 text-[#B72E35]" : ""
                    }`}
                  />
                </button>

                {/* Custom Dropdown Menu Popover */}
                {isEditSectionDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsEditSectionDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-30 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1C1816] p-2 shadow-xl space-y-1 animate-scale-in max-h-52 overflow-y-auto">
                      {sections.map((sec) => {
                        const isSelected = tableSection === sec;
                        const count = tables.filter((t) => t.section === sec).length;

                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              setTableSection(sec);
                              setIsEditSectionDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-mono transition text-left ${
                              isSelected
                                ? "bg-[#F3E7D3] dark:bg-stone-800 font-bold text-[#241F1C] dark:text-white border border-[#C9AE8B]/50 dark:border-stone-600 shadow-xs"
                                : "text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-800/60"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getSectionBadgeClass(
                                  sec
                                )}`}
                              >
                                {sec}
                              </span>
                              <span className="text-[10.5px] text-stone-400">({count} tables)</span>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Quick Pill Badges for 1-click selection */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {sections.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setTableSection(sec);
                        setIsEditSectionDropdownOpen(false);
                      }}
                      className={`text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-xl border transition ${
                        tableSection === sec
                          ? "bg-[#B72E35] text-white border-[#B72E35] shadow-xs"
                          : "bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 border-[#C9AE8B]/40 dark:border-stone-700 hover:bg-[#F3E7D3]"
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                  Seating Capacity (Guests)
                </label>
                <div className="flex items-center gap-2">
                  {[2, 4, 6, 8, 10].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTableSeats(s)}
                      className={`flex-1 rounded-xl py-1.5 text-xs font-mono font-bold border transition ${
                        tableSeats === s
                          ? "bg-[#B72E35] text-white border-[#B72E35] shadow-xs"
                          : "bg-white dark:bg-stone-900 text-[#725039] dark:text-stone-400 border-[#C9AE8B]/40 dark:border-stone-700 hover:bg-[#F3E7D3]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F3E7D3]/60 dark:bg-stone-900/60 p-3 border border-[#C9AE8B]/30 dark:border-stone-800">
                <div>
                  <span className="block text-xs font-mono font-bold text-[#241F1C] dark:text-white">Active Status</span>
                  <span className="text-[10.5px] font-mono text-stone-500">
                    {tableActive ? "Currently online for customer orders" : "Offline / Disabled"}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={tableActive}
                  onChange={(e) => setTableActive(e.target.checked)}
                  className="h-5 w-5 accent-[#B72E35] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#C9AE8B]/20 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTable(null);
                    setIsEditSectionDropdownOpen(false);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-mono text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-[#B72E35] hover:bg-[#9B252B] px-5 py-2 text-xs font-mono font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isLoading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION                                              */}
      {/* ========================================================================= */}
      {mounted && deletingTable && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-rose-200 dark:border-rose-900 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">Delete Table?</h3>
                <p className="text-xs font-mono text-stone-500">Table T-{deletingTable.label} ({deletingTable.section})</p>
              </div>
            </div>

            <p className="text-xs font-mono text-[#725039] dark:text-stone-300 leading-relaxed">
              Are you sure you want to permanently remove this dining table? The associated QR code token will also be
              deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTable(null)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-mono text-stone-600 dark:text-stone-400 hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isLoading}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-1.5 text-xs font-mono font-bold text-white shadow-md disabled:opacity-50"
              >
                {isLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MANAGE SECTIONS                                                  */}
      {/* ========================================================================= */}
      {mounted && isSectionsModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#754CFF]/15 text-[#754CFF]">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">Floor Sections</h3>
                  <p className="text-[11px] font-mono text-stone-500">Create and organize café seating zones</p>
                </div>
              </div>
              <button
                onClick={() => setIsSectionsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add Section Form */}
            <form onSubmit={handleAddSection} className="flex items-center gap-2">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="New section name (e.g. Rooftop Deck)"
                className="flex-1 rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
              />
              <button
                type="submit"
                disabled={isLoading || !newSectionName.trim()}
                className="rounded-xl bg-[#B72E35] hover:bg-[#9B252B] px-3.5 py-2 text-xs font-mono font-bold text-white shadow-xs disabled:opacity-50 shrink-0"
              >
                Add
              </button>
            </form>

            {/* Existing Sections List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <span className="text-[10.5px] font-mono uppercase text-stone-500 block font-bold">Existing Zones</span>
              {sections.map((sec) => {
                const count = sectionCounts[sec] || 0;
                const isDefault = ["smol-cafe", "smol-lounge", "smol-terrace", "Café", "Lounge", "Terrace", "Indoor Cozy", "Courtyard Verandah", "Garden Terrace", "Brew Bar"].includes(sec);

                return (
                  <div
                    key={sec}
                    className="flex items-center justify-between rounded-xl bg-white dark:bg-stone-900 p-2.5 border border-[#C9AE8B]/30 dark:border-stone-800"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-white block">{sec}</span>
                      <span className="text-[10px] font-mono text-stone-400">
                        {count} table(s) assigned {isDefault && "• Default"}
                      </span>
                    </div>

                    {!isDefault && count === 0 && (
                      <button
                        onClick={() => handleDeleteSection(sec)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                        title="Delete Section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[#C9AE8B]/20 dark:border-stone-800">
              <button
                onClick={() => setIsSectionsModalOpen(false)}
                className="rounded-xl bg-[#241F1C] dark:bg-white text-white dark:text-[#241F1C] px-4 py-2 text-xs font-mono font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REAL ARTISANAL TABLE QR STAND VIEWER                             */}
      {/* ========================================================================= */}
      {mounted && viewingQrTable && (() => {
        const origin = (qrDomain || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")).replace(/\/$/, "");
        const tableUrl = getTableUrl(origin, viewingQrTable.section, viewingQrTable.label);

        return createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingQrTable(null);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in overflow-y-auto print:p-0 print:bg-transparent print:static print:block"
          >
            {/* Prominent Floating Close Button (Always Visible On-Screen) */}
            <button
              onClick={() => setViewingQrTable(null)}
              className="fixed top-4 right-4 sm:top-6 sm:right-6 z-60 flex items-center justify-center h-11 w-11 rounded-full bg-[#241F1C] text-white hover:bg-black shadow-2xl border-2 border-white/30 transition hover:scale-110 active:scale-95 cursor-pointer print:hidden"
              title="Close (Esc)"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 sm:p-6 shadow-2xl space-y-4 text-center my-auto print:my-0 print:p-0 print:border-none print:shadow-none print:bg-transparent print:max-h-none print:max-w-none">
              <button
                onClick={() => setViewingQrTable(null)}
                className="absolute right-4 top-4 text-stone-500 hover:text-stone-800 dark:hover:text-white p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition print:hidden"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Header (Hidden on Print) */}
              <div className="print:hidden space-y-2 pr-6">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#B72E35] dark:text-[#F2C84B] font-bold">
                  Official Table QR Stand
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#241F1C] dark:text-white">
                  Table T-{viewingQrTable.label}
                </h3>
                <p className="text-xs font-mono text-[#725039] dark:text-stone-400">
                  {viewingQrTable.section} • {viewingQrTable.seats} Seater
                </p>

                {/* Domain & Host Target Input Selector */}
                <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/40 dark:bg-stone-900/60 p-3.5 space-y-2.5 text-left shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-extrabold text-[#241F1C] dark:text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                      Target QR Host URL
                    </span>
                    <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">Phone scan target</span>
                  </div>

                  {/* Dedicated full-width input */}
                  <div>
                    <input
                      type="text"
                      value={qrDomain}
                      onChange={(e) => setQrDomain(e.target.value)}
                      placeholder="e.g. https://www.smolcafe.in or http://192.168.1.100:3000"
                      className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-mono text-[#241F1C] dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40 dark:focus:ring-amber-500/40 shadow-xs"
                    />
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-mono font-semibold text-stone-500 dark:text-stone-400 mr-1">
                      Presets:
                    </span>
                    <button
                      type="button"
                      onClick={() => setQrDomain(DEFAULT_QR_DOMAIN)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                        qrDomain === DEFAULT_QR_DOMAIN
                          ? "bg-[#B72E35] text-white shadow-xs"
                          : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700 hover:bg-[#F3E7D3] dark:hover:bg-stone-700"
                      }`}
                    >
                      ✨ www.smolcafe.in
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrDomain(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                        qrDomain === (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") && qrDomain !== DEFAULT_QR_DOMAIN
                          ? "bg-[#241F1C] text-white dark:bg-white dark:text-[#241F1C] shadow-xs"
                          : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700 hover:bg-[#F3E7D3] dark:hover:bg-stone-700"
                      }`}
                    >
                      📍 Active App
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrDomain("http://localhost:3000")}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                        qrDomain === "http://localhost:3000"
                          ? "bg-[#241F1C] text-white dark:bg-white dark:text-[#241F1C] shadow-xs"
                          : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700 hover:bg-[#F3E7D3] dark:hover:bg-stone-700"
                      }`}
                    >
                      💻 Localhost (:3000)
                    </button>
                  </div>
                </div>
              </div>

              {/* Printable Table Stand Card (Real Scannable QR) */}
              <div
                id="printable-table-stand"
                style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                className="smol-printable-root mx-auto w-full max-w-[320px] rounded-3xl bg-white text-[#241F1C] p-5 shadow-lg border-2 border-stone-800 space-y-2.5 relative overflow-hidden print:shadow-none print:border-2 print:border-stone-900 print:m-auto print:break-inside-avoid print:max-w-[300px]"
              >
                {/* Brand Header with Smol Café Logo */}
                <div className="border-b border-stone-200 pb-2 flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/current_logo_transparent_on_cream.png"
                    alt="smol café"
                    className="h-14 w-auto object-contain mx-auto mb-1"
                  />
                  <span className="text-[8.5px] font-mono tracking-widest text-stone-500 uppercase font-bold">
                    Tapovan, Rishikesh
                  </span>
                </div>

                {/* Table Number Pill */}
                <div className="py-0.5">
                  <div className="inline-block rounded-xl bg-[#241F1C] text-[#FAF4EB] px-4 py-1 shadow-sm print:bg-[#241F1C] print:text-white">
                    <span className="text-[9.5px] font-mono font-bold tracking-widest uppercase block">
                      SEATING TABLE
                    </span>
                    <span className="font-serif text-2xl font-black leading-none block">
                      {viewingQrTable.label}
                    </span>
                  </div>
                  <span className="block text-[9.5px] font-mono text-stone-600 font-bold mt-1 uppercase tracking-wide">
                    {viewingQrTable.section}
                  </span>
                </div>

                {/* Real High-Resolution Scannable QR Code */}
                <div className="relative mx-auto w-48 h-48 bg-white rounded-2xl p-2 border border-stone-300 flex items-center justify-center shadow-inner print:shadow-none">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt={`Real QR Code for Table ${viewingQrTable.label}`}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-stone-400 space-y-1">
                      <QrCode className="h-10 w-10 animate-pulse" />
                      <span className="text-[10px] font-mono">Generating QR...</span>
                    </div>
                  )}
                </div>

                {/* Customer Instructions */}
                <div className="space-y-0.5">
                  <p className="text-xs font-serif font-bold text-[#241F1C]">
                    Scan to View Menu &amp; Order
                  </p>
                  <p className="text-[9px] font-mono text-stone-500 leading-tight">
                    Point your phone camera • No app download required
                  </p>
                </div>

                {/* Wi-Fi Details & Direct URL Footer */}
                <div className="border-t border-stone-200 pt-1.5 text-[8.5px] font-mono text-stone-500 space-y-0.5">
                  <div className="font-bold text-[#B72E35]">
                    {tableUrl.replace(/^https?:\/\//, "")}
                  </div>
                  <div className="text-stone-400">
                    Wi-Fi: <span className="text-stone-700 font-bold">smol-guest</span> | Pass: <span className="text-stone-700 font-bold">coffee123</span>
                  </div>
                </div>
              </div>

              {/* Direct Table Link Bar with Copy (Hidden on Print) */}
              <div className="flex items-center justify-between rounded-xl bg-white dark:bg-stone-900 border border-[#C9AE8B]/40 dark:border-stone-800 p-2 text-xs font-mono print:hidden">
                <span className="truncate text-[11px] text-[#725039] dark:text-stone-300 max-w-[220px] text-left">
                  {tableUrl}
                </span>
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(tableUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-[#FAF4EB] dark:bg-stone-800 border border-[#C9AE8B]/30 px-2.5 py-1 text-[11px] text-[#241F1C] dark:text-white hover:bg-[#F3E7D3] transition shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons Toolbar (Hidden on Print) */}
              <div className="grid grid-cols-3 gap-2 pt-1 print:hidden">
                <Link
                  href={`/table/${viewingQrTable.label.toLowerCase().replace(/^(table|t)[-\s_]*/i, "")}`}
                  target="_blank"
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#241F1C] dark:bg-stone-800 text-white p-2.5 text-[11px] font-mono font-bold hover:bg-stone-800 dark:hover:bg-stone-700 transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Table</span>
                </Link>

                <button
                  onClick={() => {
                    if (qrDataUrl) {
                      const link = document.createElement("a");
                      link.href = qrDataUrl;
                      link.download = `smol-cafe-table-${viewingQrTable.label.toLowerCase()}-qr.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  disabled={!qrDataUrl}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-[11px] font-mono font-bold text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3] transition disabled:opacity-50"
                >
                  <Download className="h-4 w-4 text-[#B72E35] dark:text-[#F2C84B]" />
                  <span>Download PNG</span>
                </button>

                <button
                  onClick={() => handlePrintSingleStand(viewingQrTable, qrDataUrl, tableUrl)}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-[11px] font-mono font-bold text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3] transition shadow-xs hover:border-[#B72E35] cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-[#754CFF] dark:text-[#C4B5FD]" />
                  <span>Print Stand</span>
                </button>
              </div>

              {/* Bottom Full-Width Close Button (Hidden on Print) */}
              <div className="pt-1 print:hidden">
                <button
                  onClick={() => setViewingQrTable(null)}
                  className="w-full py-2.5 rounded-2xl bg-stone-200/80 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-[#241F1C] dark:text-white text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Close Preview</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 6: BATCH PRINT ALL TABLE STANDS                                      */}
      {/* ========================================================================= */}
      {mounted && isBatchQrModalOpen && (() => {
        const origin = (qrDomain || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")).replace(/\/$/, "");

        return createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsBatchQrModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 backdrop-blur-md p-4 animate-fade-in overflow-y-auto print:p-0 print:m-0 print:bg-transparent print:static print:block print:w-full"
          >
            {/* Prominent Floating Close Button (Always Visible On-Screen) */}
            <button
              onClick={() => setIsBatchQrModalOpen(false)}
              className="fixed top-4 right-4 sm:top-6 sm:right-6 z-60 flex items-center justify-center h-11 w-11 rounded-full bg-[#241F1C] text-white hover:bg-black shadow-2xl border-2 border-white/30 transition hover:scale-110 active:scale-95 cursor-pointer print:hidden"
              title="Close (Esc)"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="smol-printable-root relative w-full max-w-5xl rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-6 my-auto max-h-[90vh] flex flex-col print:my-0 print:p-0 print:border-none print:shadow-none print:bg-transparent print:max-h-none print:max-w-none print:w-full">
              {/* Header (Hidden on Print) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-4 print:hidden">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-[#B72E35] dark:text-[#F2C84B]" />
                    <h3 className="font-serif text-2xl font-bold text-[#241F1C] dark:text-white">
                      All Dining Table QR Stands ({tables.length} Tables)
                    </h3>
                  </div>
                  <p className="text-xs font-mono text-[#725039] dark:text-stone-400">
                    Real scannable table stand cards formatted for printing and cafe deployment
                  </p>
                  
                  {/* Domain & Host Target Input Selector */}
                  <div className="mt-2 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/40 dark:bg-stone-900/60 p-3.5 space-y-2.5 text-left shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-extrabold text-[#241F1C] dark:text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                        <QrCode className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                        Target QR Host URL
                      </span>
                      <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">Phone scan target</span>
                    </div>

                    {/* Dedicated full-width input */}
                    <div>
                      <input
                        type="text"
                        value={qrDomain}
                        onChange={(e) => setQrDomain(e.target.value)}
                        placeholder="e.g. https://www.smolcafe.in or http://192.168.1.100:3000"
                        className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-mono text-[#241F1C] dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40 dark:focus:ring-amber-500/40 shadow-xs"
                      />
                    </div>

                    {/* Preset Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] font-mono font-semibold text-stone-500 dark:text-stone-400 mr-1">
                        Presets:
                      </span>
                      <button
                        type="button"
                        onClick={() => setQrDomain(DEFAULT_QR_DOMAIN)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                          qrDomain === DEFAULT_QR_DOMAIN
                            ? "bg-[#B72E35] text-white shadow-xs"
                            : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700 hover:bg-[#F3E7D3] dark:hover:bg-stone-700"
                        }`}
                      >
                        ✨ www.smolcafe.in
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrDomain(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                          qrDomain === (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") && qrDomain !== DEFAULT_QR_DOMAIN
                            ? "bg-[#241F1C] text-white dark:bg-white dark:text-[#241F1C] shadow-xs"
                            : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700 hover:bg-[#F3E7D3] dark:hover:bg-stone-700"
                        }`}
                      >
                        📍 Active App
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrDomain("http://localhost:3000")}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                          qrDomain === "http://localhost:3000"
                            ? "bg-[#241F1C] text-white dark:bg-white dark:text-[#241F1C] shadow-xs"
                            : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700 hover:bg-[#F3E7D3] dark:hover:bg-stone-700"
                        }`}
                      >
                        💻 Localhost (:3000)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handlePrintAllStands(origin)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#B72E35] hover:bg-[#9B252B] text-white px-4 py-2 text-xs font-mono font-bold shadow-md transition cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print All Stands</span>
                  </button>

                  <button
                    onClick={() => setIsBatchQrModalOpen(false)}
                    className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-white rounded-xl hover:bg-black/5 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* 2-Column Grid on Print for Perfect A4 Page Fit (No Side Cutoff) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 pb-4 print:grid-cols-2 print:gap-4 print:overflow-visible print:p-0 print:w-full print:m-0">
                {tables.map((table) => {
                  const tableUrl = getTableUrl(origin, table.section, table.label);
                  const qrUrl = allQrDataUrls[table.label];

                  return (
                    <div
                      key={table.id}
                      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                      className="rounded-3xl bg-white text-[#241F1C] p-5 shadow-md border-2 border-stone-800 space-y-3 text-center flex flex-col justify-between print:shadow-none print:border-2 print:border-stone-900 print:break-inside-avoid print:p-3.5 print:space-y-2 print:rounded-2xl print:w-full"
                    >
                      <div className="border-b border-stone-200 pb-1.5 flex flex-col items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/current_logo_transparent_on_cream.png"
                          alt="smol café"
                          className="h-10 w-auto object-contain mx-auto mb-1"
                        />
                        <span className="text-[7.5px] font-mono tracking-widest text-stone-500 uppercase font-bold">
                          Tapovan, Rishikesh
                        </span>
                      </div>

                      <div>
                        <div className="inline-block rounded-xl bg-[#241F1C] text-[#FAF4EB] px-3 py-0.5 print:bg-[#241F1C] print:text-white">
                          <span className="text-[8.5px] font-mono font-bold tracking-widest uppercase block">
                            TABLE
                          </span>
                          <span className="font-serif text-xl font-black leading-none block">
                            {table.label}
                          </span>
                        </div>
                        <span className="block text-[9px] font-mono text-stone-600 font-bold mt-1 uppercase">
                          {table.section} • {table.seats} Seats
                        </span>
                      </div>

                      <div className="mx-auto w-36 h-36 bg-white rounded-xl p-1 border border-stone-300 flex items-center justify-center print:w-32 print:h-32">
                        {qrUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrUrl}
                            alt={`Table ${table.label} QR`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <QrCode className="h-8 w-8 text-stone-400 animate-pulse" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-serif font-bold text-[#241F1C]">
                          Scan to View Menu &amp; Order
                        </p>
                        <p className="text-[8.5px] font-mono text-stone-500">
                          Point phone camera • Instant table menu
                        </p>
                      </div>

                      <div className="border-t border-stone-200 pt-1 text-[8px] font-mono text-stone-500 space-y-0.5">
                        <div className="font-bold text-[#B72E35]">
                          {tableUrl.replace(/^https?:\/\//, "")}
                        </div>
                        <div className="text-stone-400">
                          Wi-Fi: <span className="text-stone-700 font-bold">smol-guest</span> | Pass: <span className="text-stone-700 font-bold">coffee123</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* JSON Tag Inspector Modal */}
      {inspectingTag && (
        <JsonTagInspectorModal tag={inspectingTag} onClose={() => setInspectingTag(null)} />
      )}

      {/* Print Specific CSS Rules */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 8mm;
            size: portrait;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #241F1C !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide non-printable background admin UI when printing */
          body * {
            visibility: hidden !important;
          }
          .smol-printable-root,
          .smol-printable-root * {
            visibility: visible !important;
          }
          .smol-printable-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background: transparent !important;
          }
          /* Explicitly hidden during print */
          .print\\:hidden,
          header, nav, aside, footer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
