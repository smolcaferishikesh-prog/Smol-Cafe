import { PublicMenuPageView } from "@/components/menu/PublicMenuPageView";

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

export default function MenuPage() {
  return <PublicMenuPageView />;
}
