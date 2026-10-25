import { fetchActiveOrdersAction } from "./actions";
import { OrderStatusClientView } from "@/components/orders/OrderStatusClientView";

export const metadata = {
  title: "Order Status — smol café",
  description: "Live order status tracking for your dining session at smol café.",
};

export default async function OrdersPage() {
  const result = await fetchActiveOrdersAction();

  return (
    <OrderStatusClientView
      initialOrders={result.orders}
      tableLabel={result.tableLabel}
      locationName={result.locationName}
      hasSession={result.hasSession}
      guestName={result.guestName}
    />
  );
}
