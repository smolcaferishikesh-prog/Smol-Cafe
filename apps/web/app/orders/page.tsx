import { fetchActiveOrdersAction } from "./actions";
import { OrderStatusClientView } from "@/components/orders/OrderStatusClientView";
import { fetchActiveTablesAction } from "../t/actions";

export const metadata = {
  title: "Order Status — smol café",
  description: "Live order status tracking for your dining session at smol café.",
};

export default async function OrdersPage() {
  const [result, activeTables] = await Promise.all([
    fetchActiveOrdersAction(),
    fetchActiveTablesAction().catch(() => []),
  ]);

  return (
    <OrderStatusClientView
      initialOrders={result.orders}
      tableLabel={result.tableLabel}
      locationName={result.locationName}
      hasSession={result.hasSession}
      guestName={result.guestName}
      availableTables={activeTables.map((t) => t.label)}
    />
  );
}
