/**
 * Smol Café — Master Mock Seed Data
 * Contains all 59 menu items from Smol_Door_Final_All_Day_Menu_V0_8 workbook,
 * 12 dining tables with QR tokens, active daily specials, community events, jukebox,
 * loyalty rewards, inventory, procurement, and budgets.
 */

import { getFoodImage } from "../food-images";

export interface MockLocation {

  id: string;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface MockDiningTable {
  id: string;
  location_id: string;
  label: string;
  seats: number;
  active: boolean;
  section?: string;
  created_at: string;
  updated_at: string;
}

export interface MockTableQrToken {
  id: string;
  table_id: string;
  token_hash: string;
  version: number;
  revoked_at: string | null;
  created_at: string;
}

export interface MockMenuCategory {
  id: string;
  location_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MockMenuItem {
  id: string;
  category_id: string;
  name: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MockMenuItemVersion {
  id: string;
  menu_item_id: string;
  description: string;
  image_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MockMenuPrice {
  id: string;
  menu_item_id: string;
  amount_paise: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface MockBlackboardPost {
  id: string;
  title: string;
  content: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockCafeEvent {
  id: string;
  title: string;
  description: string;
  date_time: string;
  location: string;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockEventRsvp {
  id: string;
  event_id: string;
  guest_name: string;
  guest_phone: string;
  guest_count: number;
  created_at: string;
}

export interface MockMusicSession {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface MockSongRequest {
  id: string;
  music_session_id: string;
  title: string;
  artist: string;
  votes: number;
  status: "PENDING" | "PLAYING" | "PLAYED" | "REJECTED";
  requested_by_table: string;
  created_at: string;
}

export interface MockSongVote {
  id: string;
  song_request_id: string;
  table_session_id: string;
  created_at: string;
}

export interface MockReward {
  id: string;
  title: string;
  description: string;
  points_required: number;
  discount_paise: number;
  is_active: boolean;
  created_at: string;
}

export interface MockVendor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  category: string;
  created_at: string;
}

export interface MockBudget {
  id: string;
  month: string;
  category: string;
  allocated_paise: number;
  created_at: string;
}

export interface MockIngredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  unit_cost_paise: number;
  created_at: string;
}

export const MOCK_LOCATION_ID = "00000000-0000-0000-0000-000000000001";
export const MOCK_LOCATION: MockLocation = {
  id: MOCK_LOCATION_ID,
  name: "Smol Café — Tapovan, Rishikesh",
  timezone: "Asia/Kolkata",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

const DEFAULT_ZONES: Record<string, string> = {
  "01": "smol-cafe",
  "02": "smol-cafe",
  "03": "smol-cafe",
  "04": "smol-cafe",
  "05": "smol-cafe",
  "06": "smol-cafe",
  "07": "smol-lounge",
  "08": "smol-lounge",
  "09": "smol-lounge",
  "10": "smol-lounge",
  "11": "smol-terrace",
  "12": "smol-terrace",
  "13": "smol-terrace",
  "14": "smol-terrace",
};

// 14 Dining Tables: 6 smol-cafe (01-06) + 4 smol-lounge (07-10) + 4 smol-terrace (11-14)
export const MOCK_TABLES: MockDiningTable[] = Array.from({ length: 14 }, (_, i) => {
  const tableNum = (i + 1).toString().padStart(2, "0");
  const section = i < 6 ? "smol-cafe" : i < 10 ? "smol-lounge" : "smol-terrace";
  const seats = section === "smol-terrace" ? (i % 2 === 0 ? 4 : 2) : section === "smol-lounge" ? (i % 2 === 0 ? 6 : 4) : (i % 2 === 0 ? 4 : 2);
  return {
    id: `tbl_${tableNum}`,
    location_id: MOCK_LOCATION_ID,
    label: `${tableNum}`,
    seats,
    active: true,
    section,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
});

// QR tokens for tables 01-10
export const MOCK_QR_TOKENS: MockTableQrToken[] = MOCK_TABLES.map((t) => {
  const tokenStr = `table-${t.label.toLowerCase()}`;
  return {
    id: `qr_${t.id}`,
    table_id: t.id,
    token_hash: tokenStr,
    version: 1,
    revoked_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
  };
});

// 10 Official Smol Café Menu Categories (From Smol Café Menu.pdf)
export const RAW_CATEGORIES = [
  "Kanpur Special Bun Makkhan",
  "Small Things",
  "Eggs & Breakfast",
  "Sandwiches",
  "Pasta",
  "Indian Meals",
  "Tea",
  "Coffee Classics",
  "Flavoured & Sweet Coffee",
  "Specialty Drinks & Refreshers",
];

export const MOCK_CATEGORIES: MockMenuCategory[] = RAW_CATEGORIES.map((name, index) => ({
  id: `00000000-ca00-0000-0000-${(index + 1).toString().padStart(12, "0")}`,
  location_id: MOCK_LOCATION_ID,
  name,
  sort_order: index + 1,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
}));

const catIdMap = new Map<string, string>();
MOCK_CATEGORIES.forEach((c) => catIdMap.set(c.name, c.id));

export interface RawItemData {
  cat: string;
  sub: string;
  name: string;
  desc: string;
  ingredients: string;
  prep: string;
  equipment: string;
  ware: string;
  price: number;
  ceiling: number;
  avail: string;
  pairing: string;
  saathi: boolean;
  dietary: string;
  protein: string;
  spice: string;
  status: string;
  notes: string;
}

export const RAW_MENU_ITEMS: RawItemData[] = [
  // 1. Kanpur Special Bun Makkhan
  {
    cat: "Kanpur Special Bun Makkhan",
    sub: "Sweet",
    name: "Honey + Jaggery Bun Makkhan",
    desc: "Multigrain brown bread bun with hand-churned white butter, honey & jaggery.",
    ingredients: "Multigrain bun, hand-churned white butter, organic honey, crushed jaggery",
    prep: "Warm multigrain bun, slather with hand-churned white butter, drizzle honey & jaggery",
    equipment: "Panini grill / OTG",
    ware: "Side plate",
    price: 80,
    ceiling: 90,
    avail: "All Day",
    pairing: "Masala Milk Tea",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Signature sweet nostalgia bun makkhan.",
  },
  {
    cat: "Kanpur Special Bun Makkhan",
    sub: "Sweet",
    name: "Pineapple Bun Makkhan",
    desc: "Multigrain brown bread bun with hand-churned white butter & pineapple preserve.",
    ingredients: "Multigrain bun, hand-churned white butter, artisanal pineapple preserve",
    prep: "Warm bun, spread hand-churned white butter and pineapple preserve",
    equipment: "Panini grill / OTG",
    ware: "Side plate",
    price: 80,
    ceiling: 90,
    avail: "All Day",
    pairing: "Masala Milk Tea",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Fruity sweet bun makkhan.",
  },
  {
    cat: "Kanpur Special Bun Makkhan",
    sub: "Sweet",
    name: "Orange Bun Makkhan",
    desc: "Multigrain brown bread bun with hand-churned white butter & orange preserve.",
    ingredients: "Multigrain bun, hand-churned white butter, orange marmalade preserve",
    prep: "Warm bun, spread hand-churned white butter and zesty orange preserve",
    equipment: "Panini grill / OTG",
    ware: "Side plate",
    price: 80,
    ceiling: 90,
    avail: "All Day",
    pairing: "Masala Milk Tea",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Citrusy sweet bun makkhan.",
  },
  {
    cat: "Kanpur Special Bun Makkhan",
    sub: "Savoury",
    name: "Kanpur Masala Bun Makkhan",
    desc: "Multigrain brown bread bun with hand-churned white butter & Kanpur-style masala.",
    ingredients: "Multigrain bun, hand-churned white butter, authentic Kanpur chaat masala",
    prep: "Warm bun lightly, lather with white butter, dust with Kanpur masala",
    equipment: "Panini grill / OTG",
    ware: "Side plate",
    price: 80,
    ceiling: 90,
    avail: "All Day",
    pairing: "Masala Milk Tea",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Authentic Kanpur street style savoury bun makkhan.",
  },
  {
    cat: "Kanpur Special Bun Makkhan",
    sub: "Combo",
    name: "Bun Makkhan + Masala Milk Tea",
    desc: "Any Bun Makkhan paired with hot authentic Masala Milk Tea.",
    ingredients: "Bun Makkhan + Masala Milk Tea",
    prep: "Signature Bun Makkhan prep + fresh hot chai glass",
    equipment: "Panini grill + Chai burner",
    ware: "Side plate + Chai glass",
    price: 100,
    ceiling: 110,
    avail: "All Day",
    pairing: "—",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Signature morning and evening pairing combo.",
  },

  // 2. Small Things
  {
    cat: "Small Things",
    sub: "Fries",
    name: "Salted Fries",
    desc: "Classic crispy golden fries seasoned lightly with sea salt.",
    ingredients: "Potatoes, salt, oil",
    prep: "Deep fry until golden crisp, toss in salt",
    equipment: "Fryer / Air fryer",
    ware: "Fries bowl",
    price: 120,
    ceiling: 130,
    avail: "All Day",
    pairing: "Cappuccino / Cold Coffee",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Classic snack.",
  },
  {
    cat: "Small Things",
    sub: "Fries",
    name: "Peri Peri Fries",
    desc: "Crispy fries tossed with mildly spicy peri-peri seasoning.",
    ingredients: "Potatoes, peri-peri spice mix, salt, oil",
    prep: "Deep fry, toss vigorously in peri-peri seasoning",
    equipment: "Fryer / Air fryer",
    ware: "Fries bowl",
    price: 130,
    ceiling: 140,
    avail: "All Day",
    pairing: "Virgin Mojito / Iced Latte",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Zesty & spicy fries.",
  },
  {
    cat: "Small Things",
    sub: "Fries",
    name: "Chipotle Fries",
    desc: "Crispy fries drizzled with smoky, creamy chipotle-style sauce.",
    ingredients: "Potatoes, smoky chipotle sauce, herbs, oil",
    prep: "Fry crisp, dress with smoky chipotle sauce",
    equipment: "Fryer / Air fryer",
    ware: "Fries bowl",
    price: 150,
    ceiling: 160,
    avail: "All Day",
    pairing: "Peach Iced Tea",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Smoky creamy indulgence.",
  },
  {
    cat: "Small Things",
    sub: "Fries",
    name: "Saucy Fries",
    desc: "Crispy golden fries loaded with our creamy house sauces.",
    ingredients: "Potatoes, creamy house cheese & herb sauces",
    prep: "Fry crisp, coat in layered house sauces",
    equipment: "Fryer / Air fryer",
    ware: "Fries bowl",
    price: 160,
    ceiling: 170,
    avail: "All Day",
    pairing: "Blue Lagoon Mojito",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Loaded saucy fries.",
  },
  {
    cat: "Small Things",
    sub: "Chaat",
    name: "Sweet Corn Chaat",
    desc: "Sweet corn with onion, lemon & light spices.",
    ingredients: "Sweet corn, red onion, green chilli, lemon, chaat masala, coriander",
    prep: "Steam corn, toss with fresh ingredients and lemon",
    equipment: "Steamer",
    ware: "Small bowl",
    price: 120,
    ceiling: 130,
    avail: "All Day",
    pairing: "Masala Milk Tea",
    saathi: false,
    dietary: "Vegan",
    protein: "Medium",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Healthy, refreshing chaat.",
  },
  {
    cat: "Small Things",
    sub: "Chaat",
    name: "Crispy Corn Chaat",
    desc: "Crispy corn tossed with onion, capsicum & seasoning.",
    ingredients: "Corn kernels, cornflour, capsicum, onion, spices, lemon",
    prep: "Crisp fry batter-coated corn, toss in tangy seasoning",
    equipment: "Fryer",
    ware: "Small bowl",
    price: 150,
    ceiling: 160,
    avail: "All Day",
    pairing: "Cold Brew / Lemon Soda",
    saathi: false,
    dietary: "Vegan",
    protein: "Medium",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Crunchy spicy bar snack.",
  },

  // 3. Eggs & Breakfast
  {
    cat: "Eggs & Breakfast",
    sub: "Omelette",
    name: "Classic Omelette",
    desc: "Simple egg omelette seasoned with sea salt and cracked pepper.",
    ingredients: "Eggs, butter, salt, black pepper",
    prep: "Whisk eggs with seasoning, fold gently in hot buttered skillet",
    equipment: "Gas / induction pan",
    ware: "Main breakfast plate",
    price: 100,
    ceiling: 110,
    avail: "8:30 – 10:00 AM & All Day",
    pairing: "Americano / Masala Milk Tea",
    saathi: false,
    dietary: "Egg",
    protein: "High",
    spice: "None",
    status: "ACTIVE",
    notes: "Comforting classic breakfast.",
  },
  {
    cat: "Eggs & Breakfast",
    sub: "Omelette",
    name: "Veg Omelette",
    desc: "Egg omelette with onion, tomato & capsicum.",
    ingredients: "Eggs, onion, tomato, capsicum, green chilli, butter",
    prep: "Whisk eggs with fresh veggies and griddle cook",
    equipment: "Gas / induction pan",
    ware: "Main breakfast plate",
    price: 120,
    ceiling: 130,
    avail: "8:30 – 10:00 AM & All Day",
    pairing: "Cappuccino / Chai",
    saathi: false,
    dietary: "Egg",
    protein: "High",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Wholesome vegetable omelette.",
  },
  {
    cat: "Eggs & Breakfast",
    sub: "Omelette",
    name: "Cheesy Omelette",
    desc: "Egg omelette with melted cheese.",
    ingredients: "Eggs, melted cheese blend, butter, herbs",
    prep: "Cook omelette, fold with generous grated cheese till gooey",
    equipment: "Gas / induction pan",
    ware: "Main breakfast plate",
    price: 140,
    ceiling: 150,
    avail: "8:30 – 10:00 AM & All Day",
    pairing: "Americano / Latte",
    saathi: false,
    dietary: "Egg",
    protein: "High",
    spice: "None",
    status: "ACTIVE",
    notes: "Rich cheese melted omelette.",
  },
  {
    cat: "Eggs & Breakfast",
    sub: "Omelette",
    name: "Cheesy Mushroom Omelette",
    desc: "Egg omelette with cheese + mushrooms.",
    ingredients: "Eggs, sautéed button mushrooms, cheese, garlic butter, herbs",
    prep: "Sauté mushrooms in garlic butter, fold into omelette with cheese",
    equipment: "Gas / induction pan",
    ware: "Main breakfast plate",
    price: 150,
    ceiling: 160,
    avail: "8:30 – 10:00 AM & All Day",
    pairing: "Cappuccino / Americano",
    saathi: false,
    dietary: "Egg",
    protein: "High",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Gourmet mushroom omelette.",
  },
  {
    cat: "Eggs & Breakfast",
    sub: "Desi Breakfast",
    name: "Besan Chilla",
    desc: "Savory Indian gram flour pancake spiced with herbs and onions.",
    ingredients: "Besan (gram flour), onion, green chilli, ajwain, coriander, spices",
    prep: "Prepare seasoned gram flour batter, cook on tawa with light oil",
    equipment: "Tawa / griddle",
    ware: "Main breakfast plate",
    price: 120,
    ceiling: 130,
    avail: "8:30 – 10:00 AM & All Day",
    pairing: "Masala Milk Tea",
    saathi: true,
    dietary: "Vegan",
    protein: "High",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Healthy, gluten-friendly, protein-packed Indian pancake.",
  },

  // 4. Sandwiches
  {
    cat: "Sandwiches",
    sub: "Grilled Sandwich",
    name: "Veg Grilled Sandwich",
    desc: "Vegetables, chutney & cheese grilled to golden perfection.",
    ingredients: "Bread slices, cucumber, tomato, onion, capsicum, mint chutney, cheese",
    prep: "Assemble vegetables and chutney, press grill till golden and crisp",
    equipment: "Panini grill / sandwich press",
    ware: "Plate",
    price: 120,
    ceiling: 130,
    avail: "Whole menu after 10:00 AM",
    pairing: "Masala Milk Tea / Cold Coffee",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Classic Bombay style grilled sandwich.",
  },
  {
    cat: "Sandwiches",
    sub: "Grilled Sandwich",
    name: "Paneer Grilled Sandwich",
    desc: "Paneer, vegetables, chutney & cheese pressed and toasted.",
    ingredients: "Bread slices, fresh paneer cubes, vegetables, spicy mint chutney, cheese",
    prep: "Toss paneer with light spices, assemble sandwich, grill crisp",
    equipment: "Panini grill / sandwich press",
    ware: "Plate",
    price: 150,
    ceiling: 160,
    avail: "Whole menu after 10:00 AM",
    pairing: "Iced Latte / Masala Milk Tea",
    saathi: true,
    dietary: "Vegetarian",
    protein: "High",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Protein-rich cottage cheese sandwich.",
  },

  // 5. Pasta (Choose Penne or Farfalle)
  {
    cat: "Pasta",
    sub: "Penne or Farfalle",
    name: "Red Sauce Pasta",
    desc: "Tomato-based sauce with Italian herbs. Choose Penne or Farfalle.",
    ingredients: "Pasta (Penne / Farfalle), tomato concassé, garlic, basil, olive oil",
    prep: "Boil pasta al dente, simmer in rich herb tomato sauce",
    equipment: "Pasta cooker + saute pan",
    ware: "Pasta bowl",
    price: 200,
    ceiling: 220,
    avail: "Whole menu after 10:00 AM",
    pairing: "Americano / Peach Iced Tea",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Classic tangy Italian pasta.",
  },
  {
    cat: "Pasta",
    sub: "Penne or Farfalle",
    name: "White Sauce Pasta",
    desc: "Creamy garlic sauce with herbs. Choose Penne or Farfalle.",
    ingredients: "Pasta (Penne / Farfalle), butter, cream, roasted garlic, parmesan, herbs",
    prep: "Boil pasta, toss in freshly made creamy garlic white sauce",
    equipment: "Pasta cooker + saute pan",
    ware: "Pasta bowl",
    price: 220,
    ceiling: 240,
    avail: "Whole menu after 10:00 AM",
    pairing: "Americano / Cranberry Espresso",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Velvety, creamy comfort pasta.",
  },
  {
    cat: "Pasta",
    sub: "Penne or Farfalle",
    name: "Pink Sauce Pasta",
    desc: "Creamy tomato sauce. Choose Penne or Farfalle.",
    ingredients: "Pasta (Penne / Farfalle), tomato concassé, cream, garlic, Italian herbs",
    prep: "Toss pasta in perfect 50-50 pink blend of marinara and white cream sauce",
    equipment: "Pasta cooker + saute pan",
    ware: "Pasta bowl",
    price: 220,
    ceiling: 240,
    avail: "Whole menu after 10:00 AM",
    pairing: "Americano / Orange Espresso",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "Mild-Medium",
    status: "ACTIVE",
    notes: "Best of both worlds pasta.",
  },

  // 6. Indian Meals (Served with jeera rice + salad)
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Yellow Dal Rice Bowl",
    desc: "Mild yellow lentil curry served with fragrant jeera rice + salad.",
    ingredients: "Yellow moong/arhar dal, jeera rice, cumin, garlic, ghee, fresh salad",
    prep: "Simmer seasoned dal, serve piping hot over aromatic jeera rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 150,
    ceiling: 160,
    avail: "Whole menu after 10:00 AM",
    pairing: "Lemon Soda / Chaas",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Comforting homestyle dal chawal.",
  },
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Rajma Rice Bowl",
    desc: "Kidney bean curry served with fragrant jeera rice + salad.",
    ingredients: "Himalayan kidney beans, jeera rice, onion-tomato gravy, spices, salad",
    prep: "Slow cook rajma with spices, serve over aromatic jeera rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 170,
    ceiling: 180,
    avail: "Whole menu after 10:00 AM",
    pairing: "Masala Milk Tea / Lemon Soda",
    saathi: false,
    dietary: "Vegetarian",
    protein: "High",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Beloved North Indian comfort meal.",
  },
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Chhole Rice Bowl",
    desc: "Spiced chickpea curry served with fragrant jeera rice + salad.",
    ingredients: "Kabuli chana, jeera rice, amritsari chhole masala, onion, salad",
    prep: "Simmer chickpeas in dark spiced gravy, serve over jeera rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 170,
    ceiling: 180,
    avail: "Whole menu after 10:00 AM",
    pairing: "Virgin Mojito",
    saathi: false,
    dietary: "Vegetarian",
    protein: "High",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Hearty and wholesome chickpea curry.",
  },
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Egg Curry Rice Bowl",
    desc: "Eggs in spiced curry served with fragrant jeera rice + salad.",
    ingredients: "Farm eggs, jeera rice, onion-tomato masala curry, fresh salad",
    prep: "Pan fry boiled eggs, simmer in spicy curry, serve over jeera rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 180,
    ceiling: 190,
    avail: "Whole menu after 10:00 AM",
    pairing: "Americano / Lemon Soda",
    saathi: false,
    dietary: "Egg",
    protein: "High",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Protein-packed homestyle egg curry.",
  },
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Matar Mushroom Rice Bowl",
    desc: "Peas & mushroom home-style gravy served with jeera rice + salad.",
    ingredients: "Button mushrooms, green peas, jeera rice, onion-tomato gravy, salad",
    prep: "Sauté mushrooms and peas in rich gravy, serve over jeera rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 200,
    ceiling: 210,
    avail: "Whole menu after 10:00 AM",
    pairing: "Masala Milk Tea / Cold Brew",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Vegetarian delicacy.",
  },
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Kadhai Paneer Rice Bowl",
    desc: "Paneer, onion & capsicum gravy served with jeera rice + salad.",
    ingredients: "Fresh paneer, capsicum, onion, whole coriander & kadhai spices, jeera rice",
    prep: "Toss paneer & veggies with crushed kadhai masala, serve over rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 220,
    ceiling: 230,
    avail: "Whole menu after 10:00 AM",
    pairing: "Peach Iced Tea",
    saathi: false,
    dietary: "Vegetarian",
    protein: "High",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Spicy aromatic paneer curry.",
  },
  {
    cat: "Indian Meals",
    sub: "Rice Bowl",
    name: "Paneer Butter Masala Rice Bowl",
    desc: "Rich creamy tomato-butter gravy with paneer served with jeera rice + salad.",
    ingredients: "Fresh paneer, butter, fresh cream, cashew-tomato gravy, kasuri methi, jeera rice",
    prep: "Simmer paneer in velvety makhani gravy, serve over jeera rice",
    equipment: "Rice cooker + gas burner",
    ware: "9 in deep meal bowl",
    price: 240,
    ceiling: 250,
    avail: "Whole menu after 10:00 AM",
    pairing: "Iced Latte",
    saathi: false,
    dietary: "Vegetarian",
    protein: "High",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Rich creamy Punjabi style paneer.",
  },
  {
    cat: "Indian Meals",
    sub: "Thali Add-on",
    name: "Make it a Thali",
    desc: "Includes 2 roti + raita + salad.",
    ingredients: "2 whole wheat rotis, spiced raita, salad",
    prep: "Puff fresh tawa rotis, portion raita and salad",
    equipment: "Tawa",
    ware: "Thali plate",
    price: 70,
    ceiling: 80,
    avail: "Whole menu after 10:00 AM",
    pairing: "—",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Medium",
    spice: "None",
    status: "ACTIVE",
    notes: "Complete meal upgrade for any rice bowl.",
  },
  {
    cat: "Indian Meals",
    sub: "Bread",
    name: "Extra Roti",
    desc: "Single hot whole wheat tawa roti.",
    ingredients: "Whole wheat flour, water",
    prep: "Puff fresh on tawa",
    equipment: "Tawa",
    ware: "Bread basket",
    price: 10,
    ceiling: 15,
    avail: "Whole menu after 10:00 AM",
    pairing: "—",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Extra whole wheat tawa roti.",
  },

  // 7. Tea
  {
    cat: "Tea",
    sub: "Chai",
    name: "Masala Milk Tea",
    desc: "Classic Indian chai with milk and spices.",
    ingredients: "Tea leaves, milk, crushed ginger, cardamom, clove, cinnamon, sugar",
    prep: "Simmer tea decoction with fresh milk and pounded spices",
    equipment: "Gas / induction stove",
    ware: "Chai glass",
    price: 30,
    ceiling: 40,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan / Besan Chilla",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Signature daily kadak masala chai.",
  },
  {
    cat: "Tea",
    sub: "Black Tea",
    name: "Black Tea",
    desc: "Simple tea without milk.",
    ingredients: "Assam black tea leaves, hot water",
    prep: "Steep black tea leaves, strain clear",
    equipment: "Kettle",
    ware: "Tea cup",
    price: 30,
    ceiling: 40,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Clean black tea.",
  },
  {
    cat: "Tea",
    sub: "Black Tea",
    name: "Lemon Tea",
    desc: "Black tea with fresh lemon.",
    ingredients: "Black tea, fresh lemon juice, hot water, sugar/honey optional",
    prep: "Brew black tea, stir in fresh lemon juice",
    equipment: "Kettle",
    ware: "Tea cup",
    price: 40,
    ceiling: 50,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Sandwich / Fries",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Zesty digestive tea.",
  },
  {
    cat: "Tea",
    sub: "Chai",
    name: "Ginger Tea",
    desc: "Tea brewed with fresh ginger.",
    ingredients: "Tea leaves, milk, fresh ginger root, sugar",
    prep: "Pound fresh ginger, boil with tea decoction and milk",
    equipment: "Gas / induction stove",
    ware: "Chai glass",
    price: 50,
    ceiling: 60,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Kanpur Masala Bun Makkhan",
    saathi: true,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Medium",
    status: "ACTIVE",
    notes: "Warming adrak chai.",
  },
  {
    cat: "Tea",
    sub: "Herbal & Infusion",
    name: "Mint Lemon Tea",
    desc: "Black tea with fresh mint & lemon.",
    ingredients: "Black tea, fresh mint leaves, lemon juice, hot water",
    prep: "Muddle mint, steep in hot tea, add lemon squeeze",
    equipment: "Kettle",
    ware: "Tea cup",
    price: 70,
    ceiling: 80,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Veg Grilled Sandwich",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Invigorating herb tea.",
  },
  {
    cat: "Tea",
    sub: "Herbal & Infusion",
    name: "Ginger Lemon Honey Tea",
    desc: "Warm ginger, lemon & honey infusion.",
    ingredients: "Fresh ginger, organic honey, lemon juice, hot water",
    prep: "Infuse crushed ginger in hot water, finish with raw honey & lemon",
    equipment: "Kettle",
    ware: "Tea mug",
    price: 70,
    ceiling: 80,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Besan Chilla",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "Mild",
    status: "ACTIVE",
    notes: "Soothing Himalayan wellness infusion.",
  },

  // 8. Coffee Classics
  {
    cat: "Coffee Classics",
    sub: "Instant Coffee",
    name: "Black Coffee (Instant)",
    desc: "Instant coffee + hot water.",
    ingredients: "Coffee powder, hot water",
    prep: "Dissolve instant coffee in hot water",
    equipment: "Kettle",
    ware: "Coffee mug",
    price: 80,
    ceiling: 90,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Simple black coffee.",
  },
  {
    cat: "Coffee Classics",
    sub: "Instant Coffee",
    name: "Instant Coffee – Hot",
    desc: "Classic milk coffee.",
    ingredients: "Instant coffee, hot milk, sugar",
    prep: "Whip coffee and sugar, top with steamed milk",
    equipment: "Milk steamer",
    ware: "Coffee mug",
    price: 90,
    ceiling: 100,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Nostalgic desi whipped hot coffee.",
  },
  {
    cat: "Coffee Classics",
    sub: "Instant Coffee",
    name: "Instant Coffee – Iced",
    desc: "Cold milk coffee served chilled over ice.",
    ingredients: "Instant coffee, cold milk, sugar, ice cubes",
    prep: "Blend coffee, milk and sugar with ice till frothy",
    equipment: "Blender",
    ware: "Tall glass",
    price: 100,
    ceiling: 110,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Salted Fries",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Classic cold coffee.",
  },
  {
    cat: "Coffee Classics",
    sub: "Espresso",
    name: "Americano – Hot",
    desc: "Espresso with hot water.",
    ingredients: "Espresso shot, hot water",
    prep: "Pull double shot espresso, dilute with hot water",
    equipment: "Espresso machine",
    ware: "Ceramic cup",
    price: 110,
    ceiling: 120,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan / Sandwich",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Pure espresso clarity.",
  },
  {
    cat: "Coffee Classics",
    sub: "Espresso",
    name: "Americano – Iced",
    desc: "Espresso over ice and cold filtered water.",
    ingredients: "Espresso shot, cold water, ice cubes",
    prep: "Pull espresso, pour over ice and cold water",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 120,
    ceiling: 130,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Sandwich / Pasta",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Crisp iced espresso.",
  },
  {
    cat: "Coffee Classics",
    sub: "Espresso",
    name: "Cappuccino",
    desc: "Espresso, milk & foam.",
    ingredients: "Double espresso, textured steamed milk, milk foam",
    prep: "Pull espresso, steam milk to microfoam, pour with distinct foam cap",
    equipment: "Espresso machine",
    ware: "Cappuccino cup",
    price: 140,
    ceiling: 150,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Fries / Sandwich",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Smol café staple cappuccino.",
  },
  {
    cat: "Coffee Classics",
    sub: "Espresso",
    name: "Latte – Hot",
    desc: "Smooth and milky hot latte.",
    ingredients: "Espresso, steamed milk, light foam",
    prep: "Pull espresso, steam milk with silky microfoam, pour latte art",
    equipment: "Espresso machine",
    ware: "Latte glass / ceramic cup",
    price: 150,
    ceiling: 160,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Paneer Grilled Sandwich",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Smooth, milky hot latte.",
  },
  {
    cat: "Coffee Classics",
    sub: "Espresso",
    name: "Latte – Iced",
    desc: "Smooth and milky chilled iced latte over crystal ice.",
    ingredients: "Espresso, cold milk, ice cubes",
    prep: "Layer cold milk over ice, crown with freshly pulled espresso",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 160,
    ceiling: 170,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Chipotle Fries",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Chilled layered iced latte.",
  },

  // 9. Flavoured & Sweet Coffee
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Spanish Latte – Hot",
    desc: "Sweet condensed-milk latte.",
    ingredients: "Espresso, condensed milk, steamed milk",
    prep: "Blend condensed milk with hot espresso, top with textured steamed milk",
    equipment: "Espresso machine",
    ware: "Ceramic cup",
    price: 170,
    ceiling: 180,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Indulgent sweet Spanish latte.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Spanish Latte – Iced",
    desc: "Sweet condensed-milk latte served over ice.",
    ingredients: "Espresso, condensed milk, cold milk, ice",
    prep: "Stir condensed milk and cold milk over ice, top with espresso",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 180,
    ceiling: 190,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Peri Peri Fries",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Sweet creamy iced coffee.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Mocha – Hot",
    desc: "Coffee with chocolate.",
    ingredients: "Espresso, dark chocolate sauce, steamed milk, cocoa dust",
    prep: "Whisk chocolate into espresso, steam milk and pour",
    equipment: "Espresso machine",
    ware: "Ceramic cup",
    price: 170,
    ceiling: 180,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Decadent chocolate espresso.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Mocha – Iced",
    desc: "Coffee with chocolate served chilled over ice.",
    ingredients: "Espresso, chocolate sauce, cold milk, ice",
    prep: "Blend chocolate with espresso, pour over ice and cold milk",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 180,
    ceiling: 190,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Salted Fries",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Iced chocolate coffee indulgence.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Hazelnut Latte – Hot",
    desc: "Hazelnut flavoured latte.",
    ingredients: "Espresso, roasted hazelnut syrup, steamed milk",
    prep: "Incorporate hazelnut with espresso, pour steamed microfoam milk",
    equipment: "Espresso machine",
    ware: "Ceramic cup",
    price: 170,
    ceiling: 180,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Sandwich",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Aromatic nutty roasted hazelnut latte.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Hazelnut Latte – Iced",
    desc: "Hazelnut flavoured latte served over ice.",
    ingredients: "Espresso, roasted hazelnut syrup, cold milk, ice",
    prep: "Layer hazelnut syrup, cold milk, and ice, crown with espresso",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 180,
    ceiling: 190,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Saucy Fries",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Chilled nutty latte.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Vanilla Latte – Hot",
    desc: "Vanilla flavoured latte.",
    ingredients: "Espresso, French vanilla syrup, steamed milk",
    prep: "Combine vanilla with espresso, pour velvety steamed milk",
    equipment: "Espresso machine",
    ware: "Ceramic cup",
    price: 170,
    ceiling: 180,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Warm vanilla bean latte.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Flavoured Latte",
    name: "Vanilla Latte – Iced",
    desc: "Vanilla flavoured latte served over ice.",
    ingredients: "Espresso, vanilla syrup, cold milk, ice",
    prep: "Pour vanilla syrup and milk over ice, top with fresh espresso",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 180,
    ceiling: 190,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Sweet Corn Chaat",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Refreshing iced vanilla latte.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Dessert Coffee",
    name: "Tiramisu Latte – Hot",
    desc: "Dessert-style coffee. Limited servings daily.",
    ingredients: "Espresso, tiramisu mascarpone sauce, steamed milk, dark cocoa dust",
    prep: "Infuse tiramisu cream with espresso, top with foam and dusting of cocoa",
    equipment: "Espresso machine",
    ware: "Ceramic cup",
    price: 190,
    ceiling: 200,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Signature dessert coffee. Limited daily servings.",
  },
  {
    cat: "Flavoured & Sweet Coffee",
    sub: "Dessert Coffee",
    name: "Tiramisu Latte – Iced",
    desc: "Chilled dessert-style coffee. Limited servings daily.",
    ingredients: "Espresso, tiramisu cream syrup, cold milk, ice, cocoa dusting",
    prep: "Layer tiramisu cream and cold milk over ice, float espresso, dust cocoa",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 200,
    ceiling: 210,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Salted Fries",
    saathi: false,
    dietary: "Vegetarian",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Signature iced dessert coffee. Limited daily servings.",
  },

  // 10. Specialty Drinks & Refreshers
  {
    cat: "Specialty Drinks & Refreshers",
    sub: "Refresher",
    name: "Lemon Soda",
    desc: "Fresh lemon + sparkling soda.",
    ingredients: "Fresh lemon juice, sparkling soda, rock salt, mint, simple syrup",
    prep: "Squeeze fresh lemon, add ice and fizz with chilled soda",
    equipment: "Soda bar",
    ware: "Tall glass",
    price: 80,
    ceiling: 90,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Indian Meals / Pasta",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Fizzy thirst quencher.",
  },
  {
    cat: "Specialty Drinks & Refreshers",
    sub: "Mojito",
    name: "Virgin Mojito",
    desc: "Lime + mint cooler.",
    ingredients: "Fresh mint leaves, lime wedges, simple syrup, crushed ice, soda",
    prep: "Muddle mint and lime gently, pack with crushed ice, charge with soda",
    equipment: "Bar tools / muddler",
    ware: "Tall glass",
    price: 120,
    ceiling: 130,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Sandwiches / Pasta",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Classic refreshing cooler.",
  },
  {
    cat: "Specialty Drinks & Refreshers",
    sub: "Mojito",
    name: "Blue Lagoon Mojito",
    desc: "Sweet citrus blue cooler.",
    ingredients: "Blue curacao syrup, lime juice, mint leaves, crushed ice, soda",
    prep: "Layer blue curacao, muddled lime and mint over crushed ice, top with soda",
    equipment: "Bar tools",
    ware: "Tall glass",
    price: 130,
    ceiling: 140,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Peri Peri Fries",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Eye-catching vibrant citrus cooler.",
  },
  {
    cat: "Specialty Drinks & Refreshers",
    sub: "Iced Tea",
    name: "Peach Iced Tea",
    desc: "Cold tea with peach flavour.",
    ingredients: "Brewed black tea, peach puree/syrup, lemon, ice, mint garnish",
    prep: "Shake brewed cold tea with peach nectar and ice, pour with lemon wheel",
    equipment: "Cocktail shaker",
    ware: "Tall glass",
    price: 140,
    ceiling: 150,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Veg Grilled Sandwich",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Sweet fruity iced tea favourite.",
  },
  {
    cat: "Specialty Drinks & Refreshers",
    sub: "Espresso Tonic & Citrus",
    name: "Orange Espresso",
    desc: "Citrusy espresso drink.",
    ingredients: "Freshly squeezed orange juice, double espresso, ice",
    prep: "Fill glass with ice and chilled orange juice, gently float hot espresso on top",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 170,
    ceiling: 180,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Bun Makkhan",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Contemporary citrus-forward specialty coffee.",
  },
  {
    cat: "Specialty Drinks & Refreshers",
    sub: "Espresso Tonic & Citrus",
    name: "Cranberry Espresso",
    desc: "Sweet-tart espresso drink.",
    ingredients: "Cranberry juice, double espresso, ice, rosemary garnish",
    prep: "Pour cranberry juice over crystal ice, float fresh espresso crown",
    equipment: "Espresso machine",
    ware: "Tall glass",
    price: 180,
    ceiling: 190,
    avail: "8:30 AM – 10:00 PM",
    pairing: "Crispy Corn Chaat",
    saathi: false,
    dietary: "Vegan",
    protein: "Low",
    spice: "None",
    status: "ACTIVE",
    notes: "Stunning sweet-tart specialty espresso cooler.",
  },
];

export const MOCK_MENU_ITEMS: MockMenuItem[] = RAW_MENU_ITEMS.map((item, index) => {
  const catId = catIdMap.get(item.cat) || MOCK_CATEGORIES[0].id;
  const itemId = `00000000-0017-0000-0000-${(index + 1).toString().padStart(12, "0")}`;
  return {
    id: itemId,
    category_id: catId,
    name: item.name,
    status: item.status,
    metadata: {
      dietary: item.dietary,
      protein_focus: item.protein,
      spice: item.spice,
      best_pairing: item.pairing,
      chai_ke_saathi: item.saathi,
      subcategory: item.sub,
      availability: item.avail,
      core_ingredients: item.ingredients,
      primary_equipment: item.equipment,
      serving_ware: item.ware,
      internal_notes: item.notes,
    },
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
});

export const MOCK_MENU_VERSIONS: MockMenuItemVersion[] = RAW_MENU_ITEMS.map((item, index) => {
  const itemId = `00000000-0017-0000-0000-${(index + 1).toString().padStart(12, "0")}`;
  return {
    id: `00000000-00fe-0000-0000-${(index + 1).toString().padStart(12, "0")}`,
    menu_item_id: itemId,
    description: item.desc,
    image_url: getFoodImage(item.name),
    metadata: {
      dietary: item.dietary,
      protein_focus: item.protein,
      spice: item.spice,
      best_pairing: item.pairing,
      chai_ke_saathi: item.saathi,
      subcategory: item.sub,
      availability: item.avail,
      core_ingredients: item.ingredients,
      primary_equipment: item.equipment,
      serving_ware: item.ware,
      internal_notes: item.notes,
    },
    created_at: "2026-08-01T00:00:00.000Z",
  };
});

export const MOCK_MENU_PRICES: MockMenuPrice[] = RAW_MENU_ITEMS.map((item, index) => {
  const itemId = `00000000-0017-0000-0000-${(index + 1).toString().padStart(12, "0")}`;
  return {
    id: `00000000-00be-0000-0000-${(index + 1).toString().padStart(12, "0")}`,
    menu_item_id: itemId,
    amount_paise: item.price * 100,
    currency: "INR",
    effective_from: "2026-08-01T00:00:00.000Z",
    effective_to: null,
    created_at: "2026-08-01T00:00:00.000Z",
  };
});

// Blackboard Posts
export const MOCK_BLACKBOARD_POSTS: MockBlackboardPost[] = [
  {
    id: "bb_01",
    title: "Rishikesh Morning Special",
    content: "Kanpur Bun Makkhan + Hot Smol Chai at ₹99 all morning. Freshly baked buns with salted Amul butter.",
    starts_at: "2026-08-01T00:00:00.000Z",
    ends_at: "2026-12-31T23:59:59.000Z",
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bb_02",
    title: "Himalayan Buransh Fizz",
    content: "Wild Rhododendron flower cordial, fresh lime and chilled sparkling water — local forage from Garhwal hills.",
    starts_at: "2026-08-01T00:00:00.000Z",
    ends_at: "2026-12-31T23:59:59.000Z",
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
];

// Community Events
export const MOCK_CAFE_EVENTS: MockCafeEvent[] = [
  {
    id: "evt_01",
    title: "Chai & Poetry Circle",
    description: "An intimate evening of Hindi, Urdu & English spoken word by the Ganges. Chai is on the house.",
    date_time: "2026-08-28T18:00:00.000Z",
    location: "Smol Café Rooftop Garden",
    max_capacity: 25,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "evt_02",
    title: "Sunday Acoustic Jam",
    description: "Unplugged indie folk & classical guitar session over pour-over brews & warm brownies.",
    date_time: "2026-08-30T17:30:00.000Z",
    location: "Smol Café Ground Floor",
    max_capacity: 35,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
];

export const MOCK_EVENT_RSVPS: MockEventRsvp[] = [
  {
    id: "rsvp_01",
    event_id: "evt_01",
    guest_name: "Aarav Sharma",
    guest_phone: "+91 98765 43210",
    guest_count: 2,
    created_at: "2026-08-20T12:00:00.000Z",
  },
  {
    id: "rsvp_02",
    event_id: "evt_01",
    guest_name: "Meera Sen",
    guest_phone: "+91 98123 45678",
    guest_count: 1,
    created_at: "2026-08-21T15:30:00.000Z",
  },
  {
    id: "rsvp_03",
    event_id: "evt_02",
    guest_name: "Devendra Negi",
    guest_phone: "+91 99988 77665",
    guest_count: 4,
    created_at: "2026-08-22T09:15:00.000Z",
  },
];

// Jukebox
export const MOCK_MUSIC_SESSION: MockMusicSession = {
  id: "music_ses_01",
  status: "ACTIVE",
  started_at: "2026-08-24T08:00:00.000Z",
  ended_at: null,
  created_at: "2026-08-24T08:00:00.000Z",
};

export const MOCK_SONG_REQUESTS: MockSongRequest[] = [
  {
    id: "song_01",
    music_session_id: "music_ses_01",
    title: "Ghar",
    artist: "Bharat Chauhan",
    votes: 8,
    status: "PLAYING",
    requested_by_table: "03",
    created_at: "2026-08-24T09:00:00.000Z",
  },
  {
    id: "song_02",
    music_session_id: "music_ses_01",
    title: "Kasoor (Acoustic)",
    artist: "Prateek Kuhad",
    votes: 5,
    status: "PENDING",
    requested_by_table: "05",
    created_at: "2026-08-24T09:15:00.000Z",
  },
  {
    id: "song_03",
    music_session_id: "music_ses_01",
    title: "Alag Aasmaan",
    artist: "Anuv Jain",
    votes: 4,
    status: "PENDING",
    requested_by_table: "01",
    created_at: "2026-08-24T09:30:00.000Z",
  },
  {
    id: "song_04",
    music_session_id: "music_ses_01",
    title: "Rishikesh Morning Raga",
    artist: "Smol Acoustic Trio",
    votes: 3,
    status: "PENDING",
    requested_by_table: "08",
    created_at: "2026-08-24T09:45:00.000Z",
  },
];

// Loyalty Rewards
export const MOCK_REWARDS: MockReward[] = [
  {
    id: "rew_01",
    title: "Free Smol Chai",
    description: "Redeem 50 Smol Points for our signature tapri-style ginger chai.",
    points_required: 50,
    discount_paise: 2900,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "rew_02",
    title: "Kanpur Bun Makkhan",
    description: "Redeem 100 Smol Points for a warm toasted bun with generous salted butter.",
    points_required: 100,
    discount_paise: 7900,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "rew_03",
    title: "₹50 Off Any Order",
    description: "Get flat ₹50 discount on your current table bill.",
    points_required: 100,
    discount_paise: 5000,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "rew_04",
    title: "Free Classic Cold Coffee",
    description: "Redeem 150 Smol Points for a tall chilled glass of artisanal cold brew latte.",
    points_required: 150,
    discount_paise: 13900,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

// Vendors
export const MOCK_VENDORS: MockVendor[] = [
  {
    id: "ven_01",
    name: "Tapovan Dairy & Farms",
    contact_person: "Mukesh Rawat",
    phone: "+91 94120 11223",
    email: "dairy@tapovanfarms.in",
    category: "Dairy & Butter",
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "ven_02",
    name: "Himalayan Bean Co.",
    contact_person: "Sunil Joshi",
    phone: "+91 98370 44556",
    email: "roast@himalayanbeanco.com",
    category: "Specialty Coffee",
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "ven_03",
    name: "Kanpur Artisan Bakery",
    contact_person: "Ramesh Gupta",
    phone: "+91 97200 66778",
    email: "orders@kanpurbakery.in",
    category: "Breads & Buns",
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

// Budgets
export const MOCK_BUDGETS: MockBudget[] = [
  {
    id: "bud_01",
    month: "2026-08",
    category: "Dairy & Eggs",
    allocated_paise: 4500000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bud_02",
    month: "2026-08",
    category: "Specialty Coffee Beans",
    allocated_paise: 3500000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bud_03",
    month: "2026-08",
    category: "Buns & Breads",
    allocated_paise: 2000000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bud_04",
    month: "2026-08",
    category: "Kitchen Dry Goods & Spices",
    allocated_paise: 3000000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

// Ingredients
export const MOCK_INGREDIENTS: MockIngredient[] = [
  {
    id: "ing_01",
    name: "Assam CTC Tea",
    unit: "kg",
    current_stock: 12.5,
    reorder_level: 3.0,
    unit_cost_paise: 45000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "ing_02",
    name: "Full Cream Milk",
    unit: "liters",
    current_stock: 45.0,
    reorder_level: 15.0,
    unit_cost_paise: 6500,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "ing_03",
    name: "Kanpur Sweet Buns",
    unit: "pieces",
    current_stock: 60.0,
    reorder_level: 20.0,
    unit_cost_paise: 1200,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "ing_04",
    name: "Amul Salted Butter",
    unit: "kg",
    current_stock: 8.0,
    reorder_level: 2.0,
    unit_cost_paise: 56000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "ing_05",
    name: "Arabica Espresso Roast",
    unit: "kg",
    current_stock: 15.0,
    reorder_level: 4.0,
    unit_cost_paise: 140000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];
