import { getTableSessionCookie } from "@/lib/session";
import { CustomerHomeClientView } from "@/components/home/CustomerHomeClientView";

export const metadata = {
  title: "smol café — Good Coffee, Brighter Days",
  description: "A warm, literary neighbourhood café with a day-to-night personality in Rishikesh.",
};

export default async function HomePage() {
  const session = await getTableSessionCookie();

  return (
    <CustomerHomeClientView
      tableLabel={session?.tableLabel}
      locationName={session?.locationName || "Rishikesh"}
      guestName={session?.guestName}
      guestPhone={session?.guestPhone}
    />
  );
}
