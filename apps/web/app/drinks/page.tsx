import { getTableSessionCookie } from "@/lib/session";
import { resolveQrToken } from "@/app/t/actions";
import { getMenuCatalog } from "@/lib/queries/menu";
import { MenuClientView } from "@/components/menu/MenuClientView";
import { isBeverageItem } from "@/lib/station-utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Artisanal Drinks & Brews — smol café",
  description:
    "Explore our full specialty coffee, pour over, artisanal teas, coolers, and barista beverages.",
};

interface DrinksPageProps {
  searchParams: Promise<{ table?: string; t?: string }>;
}

export default async function DrinksPage({ searchParams }: DrinksPageProps) {
  const params = await searchParams;
  const tableParam = params.table || params.t;

  let session = await getTableSessionCookie();

  if (tableParam) {
    const formattedToken = tableParam.startsWith("table-")
      ? tableParam
      : `table-${tableParam.padStart(2, "0")}`;
    const res = await resolveQrToken(formattedToken, true);
    if (res.success && res.session) {
      session = res.session;
    }
  } else if (!session || !session.sessionId) {
    const res = await resolveQrToken("table-01", true);
    if (res.success && res.session) {
      session = res.session;
    }
  }

  const allCategories = await getMenuCatalog();

  // Filter categories to ONLY include items routed to the Barista Desk
  const drinksCategories = allCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        isBeverageItem(item.name, category.name)
      ),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <MenuClientView
      categories={drinksCategories}
      tableLabel={session?.tableLabel}
      locationName={session?.locationName || "Rishikesh"}
      guestName={session?.guestName}
      customTitle="drinks & brews"
    />
  );
}
