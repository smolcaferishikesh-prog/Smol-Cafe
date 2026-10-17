import { LandingPageView } from "@/components/landing/LandingPageView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "smol café — Good Coffee, Brighter Days · Tapovan, Rishikesh",
  description:
    "A warm, literary neighbourhood café with a day-to-night personality in Tapovan, Rishikesh. Single-origin pour-overs, slow sourdough bakes, book library & evening acoustic sessions.",
  keywords: [
    "smol cafe",
    "rishikesh cafe",
    "tapovan cafe",
    "best coffee in rishikesh",
    "work cafe rishikesh",
    "literary cafe",
    "pour over rishikesh",
  ],
};

export default function RootPage() {
  return <LandingPageView />;
}

