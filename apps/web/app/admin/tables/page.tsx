import React from "react";
import { fetchTablesAndSectionsAction } from "./actions";
import { TableManager } from "@/components/admin/TableManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dining Tables & Floor Sections — smol café Admin",
  description: "Add, edit, remove dining tables and customize floor sections/zones with QR generation.",
};

export default async function AdminTablesPage() {
  const { tables, sections } = await fetchTablesAndSectionsAction();

  return <TableManager initialTables={tables} initialSections={sections} />;
}
