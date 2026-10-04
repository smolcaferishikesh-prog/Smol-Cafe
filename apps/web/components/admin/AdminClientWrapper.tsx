"use client";

import React from "react";
import { AdminTowerDashboard } from "./AdminTowerDashboard";
import type { AdminOverviewData } from "@/app/admin/actions";

interface AdminClientWrapperProps {
  initialMetrics?: {
    activeTablesCount?: number;
    activeOrdersCount?: number;
    lowStockCount?: number;
  };
  initialOverviewData?: AdminOverviewData;
}

export const AdminClientWrapper: React.FC<AdminClientWrapperProps> = ({ initialMetrics, initialOverviewData }) => {
  return (
    <AdminTowerDashboard
      initialMetrics={initialMetrics}
      initialOverviewData={initialOverviewData}
    />
  );
};

