import { PublicMenuPageView, type PublicLiveCatalogItem } from "@/components/menu/PublicMenuPageView";
import { getMenuCatalog } from "@/lib/queries/menu";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Menu — smol café · Tapovan, Rishikesh",
  description:
    "Artisanal coffees, spiced Kanpur bun makkhan, homestyle comfort bowls, wholesome thalis & Himalayan herbal infusions in Upper Tapovan, Rishikesh.",
  keywords: [
    "smol cafe menu",
    "rishikesh cafe menu",
    "tapovan coffee menu",
    "bun makkhan rishikesh",
    "thali tapovan",
    "pour over coffee rishikesh",
  ],
};

export default async function MenuPage() {
  const liveCatalogByName: Record<string, PublicLiveCatalogItem> = {};
  try {
    const categories = await getMenuCatalog(true);
    for (const cat of categories) {
      for (const item of cat.items) {
        const key = item.name.trim().toLowerCase();
        const metaAvail = String(item.metadata?.availability || "").toUpperCase();
        const isSoldOut = item.status === "SOLD_OUT" || metaAvail === "SOLD_OUT";
        liveCatalogByName[key] = {
          id: item.id,
          name: item.name,
          priceRupees: Math.round(item.pricePaise / 100),
          status: isSoldOut ? "SOLD_OUT" : "AVAILABLE",
        };
      }
    }
  } catch (err) {
    console.warn("Could not load live catalog overlay for public menu:", err);
  }

  return <PublicMenuPageView initialLiveCatalog={liveCatalogByName} />;
}
