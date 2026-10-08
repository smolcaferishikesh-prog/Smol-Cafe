import { getTableSessionCookie } from "@/lib/session";
import { resolveQrToken } from "@/app/t/actions";
import { getMenuCatalog } from "@/lib/queries/menu";
import { MenuClientView } from "@/components/menu/MenuClientView";
import { fetchCustomerPendingOrderForEditAction } from "@/app/menu/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Smol Menu — smol café",
  description:
    "Browse our full menu of artisanal coffees, all-day breakfasts, comfort bowls, and treats.",
};

interface SmolMenuPageProps {
  searchParams: Promise<{ table?: string; t?: string; editOrder?: string }>;
}

export default async function SmolMenuPage({ searchParams }: SmolMenuPageProps) {
  const params = await searchParams;
  const tableParam = params.table || params.t;
  const editOrderId = params.editOrder;

  let session = await getTableSessionCookie();

  // If table parameter passed via QR scan (e.g. /smol-menu?table=02), resolve or switch session
  if (tableParam) {
    const formattedToken = tableParam.startsWith("table-")
      ? tableParam
      : `table-${tableParam.padStart(2, "0")}`;
    const res = await resolveQrToken(formattedToken, true);
    if (res.success && res.session) {
      session = res.session;
    }
  } else if (!session || !session.sessionId) {
    // Default fallback to Table 01 for direct visits
    const res = await resolveQrToken("table-01", true);
    if (res.success && res.session) {
      session = res.session;
    }
  }

  // Fetch pending order for customer editing flow
  let initialEditingOrder = null;
  if (editOrderId) {
    const editRes = await fetchCustomerPendingOrderForEditAction(editOrderId);
    if (editRes.success && editRes.order) {
      initialEditingOrder = editRes.order;
    }
  }

  const categories = await getMenuCatalog();

  return (
    <MenuClientView
      categories={categories}
      tableLabel={initialEditingOrder?.tableLabel || session?.tableLabel}
      locationName={session?.locationName || "Rishikesh"}
      guestName={session?.guestName}
      initialEditingOrder={initialEditingOrder}
    />
  );
}
