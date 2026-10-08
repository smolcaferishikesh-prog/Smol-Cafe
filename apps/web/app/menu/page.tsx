import { getTableSessionCookie } from "@/lib/session";
import { getMenuCatalog } from "@/lib/queries/menu";
import { MenuClientView } from "@/components/menu/MenuClientView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Menu — smol café",
  description:
    "Browse our full menu of artisanal coffees, all-day breakfasts, comfort bowls, and treats.",
};

export default async function MenuPage() {
  const session = await getTableSessionCookie();
  const categories = await getMenuCatalog();

  return (
    <MenuClientView
      categories={categories}
      tableLabel={session?.tableLabel}
      locationName={session?.locationName || "Rishikesh"}
      guestName={session?.guestName}
    />
  );
}
