import React from "react";
import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchTablesAndSectionsAction } from "./actions";
import { TableManager } from "@/components/admin/TableManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dining Tables & Floor Sections — smol café Admin",
  description: "Add, edit, remove dining tables and customize floor sections/zones with QR generation.",
};

export default async function AdminTablesPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const { tables, sections } = await fetchTablesAndSectionsAction();

  return <TableManager initialTables={tables} initialSections={sections} />;
}
