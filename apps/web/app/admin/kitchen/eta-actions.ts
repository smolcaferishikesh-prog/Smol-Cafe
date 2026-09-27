"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface OrderAccuracyRecord {
  id: string;
  orderNo: number;
  createdAt: string;
  servedAt: string;
  predictedMin: number;
  predictedMax: number;
  predictedSeconds: number;
  actualSeconds: number;
  errorSeconds: number;
  accuracyCategory: "ON_TIME" | "FASTER" | "SLOWER";
}

export interface StationLoadOverview {
  stationId: string;
  stationName: string;
  capacity: number;
  activeItemCount: number;
  estimatedBacklogMinutes: number;
}

export interface EtaAccuracyReport {
  success: boolean;
  totalAnalyzed: number;
  avgPredictedMinutes: number;
  avgActualMinutes: number;
  avgErrorMinutes: number;
  withinRangePercentage: number;
  records: OrderAccuracyRecord[];
  stations: StationLoadOverview[];
  message?: string;
}

/**
 * Server Action: Fetches historical ETA prediction vs actual served accuracy metrics
 */
export async function fetchEtaAccuracyReportAction(): Promise<EtaAccuracyReport> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch Served Orders with predictions
    const { data: orders } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_no,
        created_at,
        served_at,
        predicted_prep_seconds,
        actual_prep_seconds,
        prediction_error_seconds,
        eta_min_minutes,
        eta_max_minutes
      `
      )
      .in("status", ["SERVED", "PAID"])
      .not("served_at", "is", null)
      .order("served_at", { ascending: false })
      .limit(50);

    // 2. Fetch Kitchen Stations and Active Backlogs
    const { data: stations } = await supabase.from("kitchen_stations").select("*");

    const { data: activeOrderItems } = await supabase
      .from("order_items")
      .select(
        `
        quantity,
        menu_items(station_id, base_prep_seconds),
        orders!inner(status)
      `
      )
      .in("orders.status", ["SUBMITTED", "ACCEPTED", "PREPARING"]);

    // Calculate station loads
    const stationLoads: Record<string, { count: number; totalSeconds: number }> = {};
    for (const s of stations || []) {
      stationLoads[s.id] = { count: 0, totalSeconds: 0 };
    }

    for (const rawItem of (activeOrderItems as unknown[]) || []) {
      const item = rawItem as {
        quantity: number;
        menu_items?: { station_id?: string; base_prep_seconds?: number };
      };
      const stationId = item.menu_items?.station_id || "HOT_KITCHEN";
      const prepSec = item.menu_items?.base_prep_seconds || 300;
      const qty = item.quantity || 1;

      if (!stationLoads[stationId]) {
        stationLoads[stationId] = { count: 0, totalSeconds: 0 };
      }
      stationLoads[stationId].count += qty;
      stationLoads[stationId].totalSeconds += prepSec * qty;
    }

    const stationSummary: StationLoadOverview[] = (stations || []).map((s) => {
      const load = stationLoads[s.id] || { count: 0, totalSeconds: 0 };
      const cap = Math.max(1, s.parallel_capacity);
      const estBacklogMins = Math.round(load.totalSeconds / cap / 60);

      return {
        stationId: s.id,
        stationName: s.name,
        capacity: s.parallel_capacity,
        activeItemCount: load.count,
        estimatedBacklogMinutes: estBacklogMins,
      };
    });

    // Process Accuracy Records
    const accuracyRecords: OrderAccuracyRecord[] = [];
    let totalPredictedSec = 0;
    let totalActualSec = 0;
    let totalAbsErrorSec = 0;
    let withinRangeCount = 0;

    for (const rawOrder of (orders as unknown[]) || []) {
      const o = rawOrder as Record<string, unknown>;
      const orderId = String(o.id);
      const orderNo = Number(o.order_no);
      const createdAt = String(o.created_at);
      const servedAt = String(o.served_at);
      const predictedSec = Number(o.predicted_prep_seconds) || 600;
      const actualSec = Number(o.actual_prep_seconds) || 600;
      const errorSec = Number(o.prediction_error_seconds) || actualSec - predictedSec;
      const minMins = Number(o.eta_min_minutes) || Math.floor(predictedSec / 60) - 2;
      const maxMins = Number(o.eta_max_minutes) || Math.ceil(predictedSec / 60) + 2;

      const actualMins = actualSec / 60;
      let category: "ON_TIME" | "FASTER" | "SLOWER" = "ON_TIME";

      if (actualMins >= minMins && actualMins <= maxMins + 1) {
        category = "ON_TIME";
        withinRangeCount += 1;
      } else if (actualMins < minMins) {
        category = "FASTER";
      } else {
        category = "SLOWER";
      }

      totalPredictedSec += predictedSec;
      totalActualSec += actualSec;
      totalAbsErrorSec += Math.abs(errorSec);

      accuracyRecords.push({
        id: orderId,
        orderNo,
        createdAt,
        servedAt,
        predictedMin: minMins,
        predictedMax: maxMins,
        predictedSeconds: predictedSec,
        actualSeconds: actualSec,
        errorSeconds: errorSec,
        accuracyCategory: category,
      });
    }

    const totalAnalyzed = accuracyRecords.length;
    const avgPredictedMinutes =
      totalAnalyzed > 0 ? Math.round((totalPredictedSec / totalAnalyzed / 60) * 10) / 10 : 0;
    const avgActualMinutes =
      totalAnalyzed > 0 ? Math.round((totalActualSec / totalAnalyzed / 60) * 10) / 10 : 0;
    const avgErrorMinutes =
      totalAnalyzed > 0 ? Math.round((totalAbsErrorSec / totalAnalyzed / 60) * 10) / 10 : 0;
    const withinRangePercentage =
      totalAnalyzed > 0 ? Math.round((withinRangeCount / totalAnalyzed) * 100) : 100;

    return {
      success: true,
      totalAnalyzed,
      avgPredictedMinutes,
      avgActualMinutes,
      avgErrorMinutes,
      withinRangePercentage,
      records: accuracyRecords,
      stations: stationSummary,
    };
  } catch (err) {
    console.error("Error in fetchEtaAccuracyReportAction:", err);
    return {
      success: false,
      totalAnalyzed: 0,
      avgPredictedMinutes: 0,
      avgActualMinutes: 0,
      avgErrorMinutes: 0,
      withinRangePercentage: 0,
      records: [],
      stations: [],
      message: "Failed to load ETA accuracy metrics.",
    };
  }
}
