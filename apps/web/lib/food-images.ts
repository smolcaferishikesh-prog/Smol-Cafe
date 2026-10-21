/**
 * High-resolution authentic food photography mapping for every Smol Café menu item.
 * Hand-curated to match exact dishes: Bun Makkhan, Kulhad Chai, Pour Over,
 * Triple Decker Sandwiches, Khichdi, Aglio Olio, Margherita Pizza, Affogato, etc.
 */

/**
 * Global Feature Flag: Controls whether menu item photo thumbnails are rendered in the UI.
 */
export const SHOW_MENU_IMAGES: boolean = true;

export const FOOD_PRESET_OPTIONS = [
  { label: "Coffee / Latte", url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80" },
  { label: "Bun / Breakfast", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80" },
  { label: "Sandwich / Toast", url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80" },
  { label: "Bowl / Khichdi / Rice", url: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
  { label: "Pasta / Italian", url: "https://images.unsplash.com/photo-1621996346565-e3adc6d7dd74?auto=format&fit=crop&w=600&q=80" },
  { label: "Pizza", url: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80" },
  { label: "Chai / Tea", url: "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80" },
  { label: "Salad / Healthy", url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80" },
  { label: "Shake / Smoothie", url: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80" },
  { label: "Dessert / Cake", url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80" },
];

export const FOOD_IMAGE_CATALOG: Record<string, string> = {
  // Breakfast & Buns
  "bun makkhan, kanpur se":
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
  "oats, fruit & yoghurt bowl":
    "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=600&q=80",
  "masala omelette breakfast":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
  "creamy cheese mushroom omelette":
    "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?auto=format&fit=crop&w=600&q=80",
  "egg bhurji pav":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=85",
  "paneer bhurji pav":
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",

  // Sandwiches & Deckers
  "triple decker":
    "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
  "the smol triple decker":
    "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
  "creamy cheese mushroom decker":
    "https://images.unsplash.com/photo-1554433607-66b5efe9d304?auto=format&fit=crop&w=600&q=80",
  "chickpea paneer protein decker":
    "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?auto=format&fit=crop&w=600&q=80",
  "bombay toastie":
    "https://images.unsplash.com/photo-1619860860774-1e2e17343432?auto=format&fit=crop&w=600&q=80",
  "bombay style sandwich":
    "https://images.unsplash.com/photo-1619860860774-1e2e17343432?auto=format&fit=crop&w=600&q=80",
  "paneer veg sandwich":
    "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",

  // Bowls & Comfort
  "ghar wali dal khichdi":
    "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
  "dal chawal bowl":
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80",
  "rajma chawal bowl":
    "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
  "rajma rice bowl":
    "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
  "kadai paneer rice bowl":
    "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80",
  "jeera rice bowl":
    "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
  "chana crunch bowl":
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
  "smoky paneer rice bowl":
    "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=600&q=80",
  "creamy mushroom & herb rice":
    "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80",
  "creamy mushroom rice bowl":
    "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80",

  // Salads
  "crunchy chana salad":
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
  "warm mushroom & roast veg salad":
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",

  // Pasta & Pizza
  "smol pink pasta":
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  "garlic chilli aglio olio":
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80",
  "classic margherita":
    "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80",
  "paneer tikka & pickled onion pizza":
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
  "creamy mushroom & herb pizza":
    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
  "pizza lab – rotating":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80",

  // Munchies & Snacks
  "vada pav":
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
  "timur crispy potatoes":
    "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
  "crispy corn":
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80",
  "crispy corn chaat":
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80",
  "french fries":
    "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80",
  "chilli cheese toast fingers":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
  "chilli cheese toasts":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
  "chilli cheese toast":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
  "loaded papad nachos":
    "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80",
  "conversation board":
    "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80",

  // Desserts
  "affogato":
    "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=600&q=80",
  "warm chocolate brownie":
    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
  "cake for dessert":
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80",

  // Coffee, Cold Brews & Signature Drinks
  "tapovan pour over":
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=85",
  "pour over":
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=85",
  "espresso":
    "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
  "americano":
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
  "cappuccino":
    "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
  "café latte":
    "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80",
  "classic cold coffee":
    "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
  "jaggery sea-salt latte":
    "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80",
  "himalayan citrus espresso tonic":
    "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80",
  "buransh fizz":
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
  "seasonal experiment 01":
    "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80",
  "seasonal experiment 02":
    "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",

  // Cold Drinks & Shakes
  "fresh lime soda":
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
  "cucumber mint lemonade":
    "https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?auto=format&fit=crop&w=600&q=80",
  "house iced tea":
    "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
  "seasonal fresh juice":
    "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80",
  "banana peanut butter oats shake":
    "https://images.unsplash.com/photo-1553787499-6f9133860278?auto=format&fit=crop&w=600&q=80",
  "coffee cocoa shake":
    "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80",
  "seasonal fruit & yoghurt shake":
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",

  // Chai, Chaas & Hot Brews
  "smol chai":
    "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80",
  "adrak chai":
    "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
  "reset tea":
    "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80",
  "masala chaas":
    "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80",
  "smoked jeera chaas":
    "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",

  // Combos
  "chai + bun makkhan":
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
  "chai + vada pav":
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
  "chai + chilli cheese toast":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
  "chai + bhurji pav":
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
  "chai + bombay toastie":
    "https://images.unsplash.com/photo-1619860860774-1e2e17343432?auto=format&fit=crop&w=600&q=80",
};

/**
 * Returns a custom food image URL if explicitly set by Admin or Kitchen KDS.
 * If no custom image is assigned, returns empty string (no automatic stock photos).
 */
export function getFoodImage(name: string, customUrl?: string | null): string {
  if (customUrl && typeof customUrl === "string") {
    const trimmed = customUrl.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:image/") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("/")
    ) {
      return trimmed;
    }
  }
  return "";
}
