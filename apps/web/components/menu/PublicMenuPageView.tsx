"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Coffee,
  Search,
  ArrowLeft,
  Download,
  MapPin,
  Sparkles,
  ChevronDown,
  X,
  ExternalLink,
  Flame,
  Clock,
  Heart,
  Share2,
  UtensilsCrossed,
  Check,
  ArrowUp,
  Bookmark,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SMOL_CAFE_MAPS_URL } from "@/lib/constants";

type DietaryType = "veg" | "vegan" | "egg" | "non-veg";

interface MenuItemDef {
  id: string;
  name: string;
  description?: string;
  price: string;
  dietary?: DietaryType;
  tag?: string;
  combo?: boolean;
  notes?: string;
  pairWith?: string;
  bowlPrice?: number;
  thaliPrice?: number;
}

interface MenuSubcategory {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: string;
  items: MenuItemDef[];
  highlight?: {
    title: string;
    description: string;
    price: string;
  };
}

interface MenuSection {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  subcategories: MenuSubcategory[];
}

const MENU_DATA: MenuSection[] = [
  {
    id: "drinks",
    number: "01",
    title: "Coffee, Chai & Drinks",
    subtitle: "start with something to sip",
    subcategories: [
      {
        id: "coffee-classics",
        title: "Coffee Classics",
        subtitle: "Espresso coffee and familiar favourites",
        icon: "☕",
        items: [
          {
            id: "black-coffee",
            name: "Black Coffee (instant)",
            description: "Instant black coffee, robust, clean and waking.",
            price: "₹80",
            dietary: "vegan",
            notes: "Clean extraction, served piping hot in ceramic mug.",
            pairWith: "Kanpur Bun Makkhan",
          },
          {
            id: "hot-instant-coffee",
            name: "Hot Instant Coffee",
            description: "Homestyle whipped instant coffee with warm frothed milk.",
            price: "₹90",
            dietary: "veg",
            notes: "Rich, nostalgic Indian beating technique with velvety foam.",
            pairWith: "Aloo Paratha",
          },
          {
            id: "iced-instant-coffee",
            name: "Iced Instant Coffee",
            description: "Creamy chilled milk coffee served over ice cubes.",
            price: "₹100",
            dietary: "veg",
            notes: "Whipped vigorously with chilled dairy milk.",
            pairWith: "Salted Fries",
          },
          {
            id: "americano",
            name: "Americano",
            description: "Bold espresso stretched with hot or iced mountain water.",
            price: "₹110 / ₹120",
            dietary: "vegan",
            tag: "Hot / Iced",
            notes: "Double shot extraction. Available hot or over rocks.",
            pairWith: "Veg Grilled Sandwich",
          },
          {
            id: "cappuccino",
            name: "Cappuccino",
            description: "Espresso, velvety steamed milk and a dense micro-foam top.",
            price: "₹140",
            dietary: "veg",
            tag: "Favorite",
            notes: "Balanced 1:1:1 ratio with artisan chocolate dusting.",
            pairWith: "Honey & Jaggery Bun Makkhan",
          },
          {
            id: "latte",
            name: "Latte",
            description: "Smooth double espresso with plenty of silky steamed milk.",
            price: "₹150 / ₹160",
            dietary: "veg",
            tag: "Hot / Iced",
            notes: "Silky texture with delicate latte art.",
            pairWith: "Cheesy Omelette",
          },
        ],
        highlight: {
          title: "Extra Espresso Shot",
          description: "Add one fresh espresso shot to any hot or iced drink.",
          price: "+₹40",
        },
      },
      {
        id: "flavoured-coffee",
        title: "Flavoured Coffee",
        subtitle: "Choose hot or iced · Sweet and dessert-style coffees",
        icon: "✨",
        items: [
          {
            id: "spanish-latte",
            name: "Spanish Latte",
            description: "Sweetened with condensed milk for a silky, caramel finish.",
            price: "₹170 / ₹180",
            dietary: "veg",
            tag: "Bestseller",
            notes: "Rich, velvety mouthfeel balanced by bold espresso.",
            pairWith: "Salted Fries",
          },
          {
            id: "mocha",
            name: "Mocha",
            description: "Artisanal cocoa meets rich espresso and steamed milk.",
            price: "₹170 / ₹180",
            dietary: "veg",
            notes: "Dark chocolate ganache blended with double shot.",
            pairWith: "Kanpur Masala Bun",
          },
          {
            id: "hazelnut-latte",
            name: "Hazelnut Latte",
            description: "Fragrant toasted hazelnut syrup folded into velvety espresso.",
            price: "₹170 / ₹180",
            dietary: "veg",
            notes: "Subtle nutty warmth with aromatic roasted finish.",
          },
          {
            id: "vanilla-latte",
            name: "Vanilla Latte",
            description: "Sweet aromatic vanilla bean notes with smooth coffee.",
            price: "₹170 / ₹180",
            dietary: "veg",
            notes: "Light floral sweetness infused in steamed whole milk.",
          },
          {
            id: "tiramisu-latte",
            name: "Tiramisu Latte",
            description: "Creamy, dessert-style coffee topped with cocoa dusting.",
            price: "₹190 / ₹200",
            dietary: "veg",
            tag: "Signature",
            notes: "Mascarpone inspired crema with ladyfinger cookie aroma.",
            pairWith: "Crispy Corn Chaat",
          },
        ],
      },
      {
        id: "signature-espresso",
        title: "Signature Espresso",
        subtitle: "Bold artisanal creations with bright citrus pairings",
        icon: "🍊",
        items: [
          {
            id: "orange-espresso",
            name: "Orange Espresso",
            description: "Fresh citrus zest and orange juice balanced with espresso.",
            price: "₹170",
            dietary: "vegan",
            tag: "Chef Pick",
            notes: "Layered sparkling presentation. Stir before sipping.",
          },
          {
            id: "cranberry-espresso",
            name: "Cranberry Espresso",
            description: "Tart cranberry reduction topped with chilled espresso.",
            price: "₹180",
            dietary: "vegan",
            notes: "Sharp tartness cuts cleanly through rich espresso crema.",
          },
          {
            id: "blue-ice-latte",
            name: "Blue Ice Latte",
            description: "Iced espresso, chilled milk and vibrant blue citrus syrup.",
            price: "₹180",
            dietary: "veg",
            tag: "Visual Special",
            notes: "Three distinct visual layers over ice. Photogenic favourite.",
          },
        ],
      },
      {
        id: "chai-tea",
        title: "Chai & Tea",
        subtitle: "Freshly brewed with whole mountain spices and herbs",
        icon: "🫖",
        items: [
          {
            id: "masala-milk-chai",
            name: "Masala Milk Chai",
            description: "Traditional Indian milk tea slow-brewed with ginger and spices.",
            price: "₹30",
            dietary: "veg",
            tag: "Tapovan Staple",
            notes: "Boiled twice in brass pot with fresh ginger & cardamom pods.",
            pairWith: "Kanpur Bun Makkhan (₹100 Combo)",
          },
          {
            id: "black-tea",
            name: "Black Tea",
            description: "Simple, fragrant mountain black tea brewed to clarity.",
            price: "₹30",
            dietary: "vegan",
            notes: "First flush whole leaf brew with floral notes.",
          },
          {
            id: "lemon-tea",
            name: "Lemon Tea",
            description: "Brisk black tea with freshly squeezed lemon juice.",
            price: "₹40",
            dietary: "vegan",
            notes: "Citrusy, refreshing pick-me-up on sunny afternoons.",
          },
          {
            id: "ginger-tea",
            name: "Ginger Tea",
            description: "Hand-pounded fresh Himalayan ginger root decoction.",
            price: "₹50",
            dietary: "vegan",
            notes: "Soothing warmth for mountain mornings and evenings.",
          },
          {
            id: "mint-lemon-tea",
            name: "Mint Lemon Tea",
            description: "Fresh garden mint leaves, lemon juice and clear tea.",
            price: "₹70",
            dietary: "vegan",
            notes: "Muddled fresh garden herbs infused with wild flower honey.",
          },
          {
            id: "ginger-lemon-honey-tea",
            name: "Ginger Lemon Honey Tea",
            description: "Warm ginger, freshly squeezed lemon and raw honey infusion.",
            price: "₹70",
            dietary: "veg",
            tag: "Healing",
            notes: "Ayurvedic immunity tonic brewed with organic Himalayan honey.",
          },
        ],
      },
      {
        id: "warm-cozy",
        title: "Warm & Cozy",
        subtitle: "Soothing night-time milk drinks and decadent chocolates",
        icon: "🍯",
        items: [
          {
            id: "golden-milk",
            name: "Golden Milk / Haldi Doodh",
            description: "Warm milk simmered with raw turmeric, black pepper and cardamom.",
            price: "₹99",
            dietary: "veg",
            tag: "Ayurvedic",
            notes: "Slow-simmered with crushed black pepper for turmeric bioavailability.",
          },
          {
            id: "cinnamon-milk",
            name: "Cinnamon Milk",
            description: "Steamed milk gently infused with Ceylon cinnamon bark.",
            price: "₹119",
            dietary: "veg",
            notes: "Subtly sweet, cozy and calming before bedtime.",
          },
          {
            id: "classic-hot-chocolate",
            name: "Classic Hot Chocolate",
            description: "Velvety melted dark cocoa and steamed milk.",
            price: "₹160",
            dietary: "veg",
            tag: "Cozy",
            notes: "Real melted chocolate flakes gently whisked into rich dairy milk.",
          },
          {
            id: "cinnamon-hot-chocolate",
            name: "Cinnamon Hot Chocolate",
            description: "Rich melted hot chocolate with warming cinnamon spices.",
            price: "₹180",
            dietary: "veg",
            notes: "Winter special spiced dark cocoa.",
          },
          {
            id: "espresso-hot-chocolate",
            name: "Espresso Hot Chocolate",
            description: "Our classic hot chocolate boosted with a bold shot of espresso.",
            price: "₹200",
            dietary: "veg",
            notes: "The ultimate energy & comfort blend.",
          },
        ],
      },
      {
        id: "coolers-shakes",
        title: "Coolers, Mocktails & Shakes",
        subtitle: "Sparkling mountain refreshments and thick creamy frappes",
        icon: "🥤",
        items: [
          {
            id: "virgin-mojito",
            name: "Virgin Mojito",
            description: "Fresh lemon, muddled mint and chilled sparkling soda.",
            price: "₹120",
            dietary: "vegan",
            notes: "Crisp and invigorating with brown sugar syrup.",
          },
          {
            id: "blue-lagoon",
            name: "Blue Lagoon",
            description: "Zesty blue curaçao citrus notes charged with fizzy soda.",
            price: "₹130",
            dietary: "vegan",
            notes: "Eye-catching ocean blue fizz with lime wheel.",
          },
          {
            id: "lemon-soda",
            name: "Lemon Soda",
            description: "Classic fresh lemon soda — sweet, salted or mixed.",
            price: "₹80",
            dietary: "vegan",
            notes: "Poured fresh to order with black salt & roasted cumin.",
          },
          {
            id: "peach-iced-tea",
            name: "Peach Iced Tea",
            description: "Slow-brewed black tea infused with sweet peach puree.",
            price: "₹140",
            dietary: "vegan",
            notes: "Garnished with mint sprig and lemon slice.",
          },
          {
            id: "sunrise-mocktail",
            name: "Sunrise Mocktail",
            description: "Orange juice, lemon and grenadine layered sunset gradient.",
            price: "₹150",
            dietary: "vegan",
            tag: "Refreshing",
            notes: "Inspired by Himalayan sunrise over the Ganges valley.",
          },
          {
            id: "classic-coffee-frappe",
            name: "Classic Coffee Frappe",
            description: "Blended espresso, vanilla cream and crushed ice.",
            price: "₹180",
            dietary: "veg",
            notes: "Topped with cocoa powder and whipped froth.",
          },
          {
            id: "hazelnut-frappe",
            name: "Hazelnut Frappe",
            description: "Toasted hazelnut frappe topped with whipped chocolate drizzle.",
            price: "₹200",
            dietary: "veg",
            notes: "Decadent nutty crunch in every thick sip.",
          },
          {
            id: "banana-shake",
            name: "Banana Shake",
            description: "Freshly blended ripe bananas and chilled milk.",
            price: "₹119",
            dietary: "veg",
            notes: "Naturally sweet and wholesome post-yoga smoothie.",
          },
          {
            id: "oreo-shake",
            name: "Oreo Shake",
            description: "Thick vanilla shake loaded with crushed Oreo cookies.",
            price: "₹180",
            dietary: "veg",
            tag: "Indulgent",
            notes: "Rich crushed chocolate cookies blended into thick milk.",
          },
        ],
      },
    ],
  },
  {
    id: "breakfast-bites",
    number: "02",
    title: "Breakfast & Bites",
    subtitle: "small things, made with love",
    subcategories: [
      {
        id: "bun-makkhan",
        title: "Kanpur Bun Makkhan",
        subtitle: "A soft multigrain bun, generously spread with creamy white butter",
        icon: "🧈",
        badge: "Specialty",
        items: [
          {
            id: "bm-honey-jaggery",
            name: "Honey & Jaggery",
            description: "Traditional sweet bun with wholesome jaggery and raw honey.",
            price: "₹80",
            dietary: "veg",
            notes: "Layered with authentic Kanpur white butter (makkhan).",
            pairWith: "Masala Milk Chai",
          },
          {
            id: "bm-pineapple",
            name: "Pineapple",
            description: "Fruity pineapple spread generously with white butter.",
            price: "₹80",
            dietary: "veg",
            notes: "Sweet fruit jam layered on warm soft multigrain bun.",
          },
          {
            id: "bm-orange",
            name: "Orange",
            description: "Bright citrus orange marmalade and white butter.",
            price: "₹80",
            dietary: "veg",
            notes: "Tangy citrus zest sweetness.",
          },
          {
            id: "bm-kanpur-masala",
            name: "Kanpur Masala",
            description: "Our iconic savoury, chatpata spiced butter version.",
            price: "₹80",
            dietary: "veg",
            tag: "House Special",
            notes: "Topped with roasted cumin, chaat masala & green chili flakes.",
            pairWith: "Masala Milk Chai",
          },
        ],
        highlight: {
          title: "Bun Makkhan + Chai Combo",
          description: "Pick any bun flavour paired with hot cutting masala chai.",
          price: "₹100",
        },
      },
      {
        id: "parathas",
        title: "Parathas",
        subtitle: "Indian stuffed wheat flatbread; served with fresh curd and pickle",
        icon: "🫓",
        items: [
          {
            id: "aloo-paratha",
            name: "Aloo Paratha",
            description: "Stuffed with seasoned spiced potato, cooked crisp with butter.",
            price: "₹119",
            dietary: "veg",
            tag: "Comfort",
            notes: "Rolled fresh to order on iron tawa with golden crust.",
            pairWith: "Cutting Chai",
          },
          {
            id: "paneer-paratha",
            name: "Paneer Paratha",
            description: "Stuffed with seasoned Indian cottage cheese and fresh herbs.",
            price: "₹169",
            dietary: "veg",
            notes: "Generously filled with fresh malai paneer and green coriander.",
          },
        ],
      },
      {
        id: "eggs-breakfast",
        title: "Eggs & Breakfast",
        subtitle: "Cooked fresh to order on the hot pan",
        icon: "🍳",
        items: [
          {
            id: "classic-omelette",
            name: "Classic Omelette",
            description: "Two farm eggs beaten and folded with mild seasoning.",
            price: "₹100",
            dietary: "egg",
            notes: "Served with 2 toasted multigrain bread slices.",
          },
          {
            id: "veg-omelette",
            name: "Veg Omelette",
            description: "Folded with finely diced onions, ripe tomatoes and capsicum.",
            price: "₹120",
            dietary: "egg",
            notes: "Fluffy 2-egg fold with crunchy vegetables.",
          },
          {
            id: "cheesy-omelette",
            name: "Cheesy Omelette",
            description: "Gooey melted cheese folded into fluffy golden eggs.",
            price: "₹140",
            dietary: "egg",
            notes: "Stuffed with sharp cheddar and mozzarella.",
          },
          {
            id: "cheesy-mushroom-omelette",
            name: "Cheesy Mushroom Omelette",
            description: "Tossed butter mushrooms and cheese inside fluffy eggs.",
            price: "₹150",
            dietary: "egg",
            tag: "Chef Favorite",
            notes: "Pan-roasted button mushrooms infused with garlic butter.",
          },
          {
            id: "besan-chilla",
            name: "Besan Chilla",
            description: "Savoury spiced chickpea-flour pancake with chopped greens.",
            price: "₹100",
            dietary: "vegan",
            notes: "Naturally gluten-free, high-protein traditional Indian pancake.",
            pairWith: "Masala Chai (₹120 Combo)",
          },
          {
            id: "egg-bhurji",
            name: "Egg Bhurji (4 eggs)",
            description: "Indian-style spiced scrambled eggs with onion, tomato & cilantro.",
            price: "₹180",
            dietary: "egg",
            notes: "Wholesome 4-egg protein feast served with toasted buns.",
          },
        ],
        highlight: {
          title: "Besan Chilla + Masala Chai Combo",
          description: "A simple, wholesome homestyle breakfast pairing.",
          price: "₹120",
        },
      },
      {
        id: "sandwiches-maggi",
        title: "Sandwiches & Maggi",
        subtitle: "Crispy grilled sandwiches and homestyle mountain noodles",
        icon: "🥪",
        items: [
          {
            id: "veg-grilled-sandwich",
            name: "Veg Grilled Sandwich",
            description: "Garden vegetables, fresh mint-coriander chutney and cheese.",
            price: "₹120",
            dietary: "veg",
            notes: "Golden crisp lines on panini press with spicy green chutney.",
          },
          {
            id: "paneer-grilled-sandwich",
            name: "Paneer Grilled Sandwich",
            description: "Spiced paneer cubes, vegetables and chutney grilled crisp.",
            price: "₹150",
            dietary: "veg",
            tag: "Popular",
            notes: "Marinated cottage cheese with bell peppers and melted cheese.",
          },
          {
            id: "bun-omelette",
            name: "Bun Omelette",
            description: "2 eggs in a multigrain bun. Half-fried or fully cooked. (Add veg +₹20)",
            price: "₹90",
            dietary: "egg",
            notes: "Street style butter toasted bun wrapping around fluffy eggs.",
          },
          {
            id: "plain-maggi",
            name: "Plain Maggi",
            description: "Classic Indian-style comfort noodles, freshly cooked hot.",
            price: "₹90",
            dietary: "veg",
            notes: "The undisputed taste of the mountains on chilly mornings.",
          },
          {
            id: "veggie-maggi",
            name: "Veggie Maggi",
            description: "Cooked with diced onions, tomatoes and crunchy capsicum.",
            price: "₹120",
            dietary: "veg",
            notes: "Loaded with pan-sautéed seasonal vegetables.",
          },
          {
            id: "cheesy-maggi",
            name: "Cheesy Maggi",
            description: "Topped with warm melted mozzarella cheese.",
            price: "₹140",
            dietary: "veg",
            tag: "Comfort Classic",
            notes: "Creamy cheese pulls with piping hot mountain spices.",
          },
        ],
      },
      {
        id: "fries-bites",
        title: "Fries & Small Bites",
        subtitle: "Crispy crunchies and spiced chatpata bowls",
        icon: "🍟",
        items: [
          {
            id: "salted-fries",
            name: "Salted Fries",
            description: "Golden crisp potato fries tossed with light rock salt.",
            price: "₹120",
            dietary: "vegan",
            notes: "Crisp exterior, soft fluffy center.",
          },
          {
            id: "peri-peri-fries",
            name: "Peri Peri Fries",
            description: "Tossed with our signature mildly spicy peri peri seasoning.",
            price: "₹130",
            dietary: "vegan",
            tag: "Snack Hit",
            notes: "Bold African bird's eye chili and smoked paprika dust.",
          },
          {
            id: "chipotle-fries",
            name: "Chipotle Fries",
            description: "Served with rich smoky, creamy chipotle dip on the side.",
            price: "₹150",
            dietary: "veg",
            notes: "Smoky Mexican chili dip paired with golden fries.",
          },
          {
            id: "saucy-fries",
            name: "Saucy Fries",
            description: "Crisp fries drizzled with tangy in-house sauces.",
            price: "₹160",
            dietary: "veg",
            notes: "Loaded snack platter with garlic mayo and spicy tomato drizzle.",
          },
          {
            id: "sweet-corn-chaat",
            name: "Sweet Corn Chaat",
            description: "Steamed sweet corn tossed with butter, fresh lemon and spices.",
            price: "₹120",
            dietary: "veg",
            notes: "Juicy sweet corn with tangy chaat masala.",
          },
          {
            id: "crispy-corn-chaat",
            name: "Crispy Corn Chaat",
            description: "Crunchy golden fried corn tossed with vegetables and spices.",
            price: "₹150",
            dietary: "vegan",
            tag: "Chef Special",
            notes: "Irresistibly crunchy snack with cilantro and freshly squeezed lime.",
          },
        ],
      },
    ],
  },
  {
    id: "meals-thalis",
    number: "03",
    title: "Indian Meals & Pasta",
    subtitle: "everything explained, nothing complicated",
    subcategories: [
      {
        id: "curry-bowls",
        title: "Rice Bowls & Complete Thalis",
        subtitle: "Choose Rice Bowl or upgrade to Complete Thali (+₹70)",
        icon: "🍛",
        badge: "Wholesome Meals",
        items: [
          {
            id: "yellow-dal",
            name: "Yellow Dal",
            description: "Mild yellow lentils cooked with cumin, garlic and Indian spices.",
            price: "Bowl ₹150 · Thali ₹220",
            dietary: "veg",
            bowlPrice: 150,
            thaliPrice: 220,
            notes: "Light, comforting yellow moong dal with desi ghee tadka.",
          },
          {
            id: "rajma",
            name: "Rajma",
            description: "Slow-simmered red kidney beans in homestyle Punjabi gravy.",
            price: "Bowl ₹170 · Thali ₹240",
            dietary: "veg",
            tag: "Rishikesh Favorite",
            bowlPrice: 170,
            thaliPrice: 240,
            notes: "Melt-in-mouth Jammu rajma simmered for 6 hours.",
            pairWith: "Jeera Rice & Roasted Papad",
          },
          {
            id: "chole",
            name: "Chole",
            description: "Kabuli chickpeas simmered in aromatic roasted spice gravy.",
            price: "Bowl ₹170 · Thali ₹240",
            dietary: "veg",
            bowlPrice: 170,
            thaliPrice: 240,
            notes: "Tender chickpeas steeped in whole clove, cinnamon and anardana.",
          },
          {
            id: "egg-curry",
            name: "Egg Curry",
            description: "Boiled eggs simmered in a homestyle onion-tomato gravy.",
            price: "Bowl ₹190 · Thali ₹260",
            dietary: "egg",
            bowlPrice: 190,
            thaliPrice: 260,
            notes: "Two pan-fried eggs simmered in a robust masala gravy.",
          },
          {
            id: "matar-mushroom",
            name: "Matar Mushroom",
            description: "Tender green peas and button mushrooms in a spiced gravy.",
            price: "Bowl ₹190 · Thali ₹260",
            dietary: "veg",
            bowlPrice: 190,
            thaliPrice: 260,
            notes: "Fresh green peas and button mushrooms in slow-cooked onion gravy.",
          },
          {
            id: "kadhai-paneer",
            name: "Kadhai Paneer",
            description: "Indian cottage cheese tossed with bell peppers and roasted spices.",
            price: "Bowl ₹220 · Thali ₹290",
            dietary: "veg",
            bowlPrice: 220,
            thaliPrice: 290,
            notes: "Crushed coriander seeds and kashmiri chili with fresh malai paneer.",
          },
          {
            id: "paneer-butter-masala",
            name: "Paneer Butter Masala",
            description: "Paneer cubes in a rich, buttery and creamy tomato sauce.",
            price: "Bowl ₹220 · Thali ₹290",
            dietary: "veg",
            tag: "Best Seller",
            bowlPrice: 220,
            thaliPrice: 290,
            notes: "Silky tomato gravy with hints of fenugreek leaves (kasuri methi).",
            pairWith: "Butter Roti & Chilled Raita",
          },
        ],
        highlight: {
          title: "Rice Bowl vs Complete Thali",
          description:
            "Rice Bowl includes your curry + fragrant jeera rice + fresh salad. Complete Thali includes the Rice Bowl PLUS 2 hot plain rotis and a side of raita (+₹70).",
          price: "+₹70 for Thali",
        },
      },
      {
        id: "pasta-khichdi",
        title: "Penne Pasta & Khichdi",
        subtitle: "Italian comfort pasta and nourishing Ayurvedic dal khichdi",
        icon: "🍝",
        items: [
          {
            id: "red-saune-penne",
            name: "Red Sauce Penne",
            description: "Tomato-based, slow simmered lightly tangy sauce with herbs.",
            price: "₹200",
            dietary: "veg",
            notes: "San Marzano style tomatoes, basil, garlic and olive oil.",
          },
          {
            id: "white-sauce-penne",
            name: "White Sauce Penne",
            description: "Creamy garlic and milk-based sauce tossed with penne.",
            price: "₹200",
            dietary: "veg",
            notes: "Rich béchamel sauce seasoned with black pepper and oregano.",
          },
          {
            id: "pink-sauce-penne",
            name: "Pink Sauce Penne",
            description: "A silky, harmonious blend of red tomato and creamy white sauce.",
            price: "₹220",
            dietary: "veg",
            tag: "Popular",
            notes: "Best of both worlds: tangy richness with garlic aroma.",
          },
          {
            id: "dal-khichdi",
            name: "Dal Khichdi",
            description: "Soft rice and lentils; quintessential Indian comforting nourishment.",
            price: "₹150",
            dietary: "veg",
            tag: "Comfort",
            notes: "Prepared with pure cow ghee tadka, cumin and fresh ginger.",
            pairWith: "Side Raita & Pickle",
          },
          {
            id: "veg-dal-khichdi",
            name: "Vegetable Dal Khichdi",
            description: "Nourishing rice, yellow lentils and seasonal fresh vegetables.",
            price: "₹170",
            dietary: "veg",
            notes: "Carrots, beans and green peas folded into warm soothing khichdi.",
          },
        ],
      },
      {
        id: "extras-sides",
        title: "Extra Sabzi & Sides",
        subtitle: "Small portions to complete or personalize your meal",
        icon: "🥣",
        items: [
          {
            id: "extra-yellow-dal",
            name: "Extra Yellow Dal",
            description: "Small katori portion for thali or bowl.",
            price: "+₹40",
            dietary: "veg",
          },
          {
            id: "extra-rajma-chole",
            name: "Extra Rajma / Chole",
            description: "Small katori of homestyle rajma or chole curry.",
            price: "+₹50",
            dietary: "veg",
          },
          {
            id: "extra-homestyle-veg",
            name: "Aloo Gobhi / Bhindi / Mix Veg",
            description: "Homestyle seasonal vegetable (subject to availability).",
            price: "+₹60",
            dietary: "veg",
          },
          {
            id: "extra-matar-mushroom",
            name: "Extra Matar Mushroom",
            description: "Small katori portion of tender peas & mushrooms.",
            price: "+₹70",
            dietary: "veg",
          },
          {
            id: "extra-paneer",
            name: "Extra Kadhai / Butter Paneer",
            description: "Small katori portion of rich paneer gravy.",
            price: "+₹110",
            dietary: "veg",
          },
          {
            id: "plain-roti",
            name: "Plain Roti",
            description: "Whole wheat freshly rolled tawa phulka.",
            price: "₹8",
            dietary: "vegan",
          },
          {
            id: "butter-roti",
            name: "Butter Roti",
            description: "Hot whole wheat roti brushed with fresh butter.",
            price: "₹10",
            dietary: "veg",
          },
          {
            id: "side-raita",
            name: "Fresh Raita",
            description: "Chilled spiced yogurt with roasted cumin.",
            price: "₹30",
            dietary: "veg",
          },
          {
            id: "side-jeera-rice",
            name: "Jeera Rice",
            description: "Fragrant basmati rice tempered with cumin seeds.",
            price: "₹60",
            dietary: "vegan",
          },
        ],
      },
    ],
  },
];

export const PublicMenuPageView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | DietaryType>("all");
  const [activeSection, setActiveSection] = useState<string>("drinks");
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const [selectedItemModal, setSelectedItemModal] = useState<MenuItemDef | null>(null);
  const [thaliViewMode, setThaliViewMode] = useState<"both" | "bowl" | "thali">("both");
  const [selectedBunFlavor, setSelectedBunFlavor] = useState("Kanpur Masala");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize wishlist from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smol_menu_wishlist");
      if (saved) {
        setWishlist(new Set(JSON.parse(saved)));
      }
    } catch {
      // safe fallback
    }
  }, []);

  // Show scroll-to-top button on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Show toast helper
  const triggerToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Toggle wishlist item
  const toggleWishlist = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        triggerToast(`Removed "${name}" from your saved list`);
      } else {
        next.add(id);
        triggerToast(`❤️ Saved "${name}" to your Tapovan wishlist!`);
      }
      try {
        localStorage.setItem("smol_menu_wishlist", JSON.stringify(Array.from(next)));
      } catch {
        // safe
      }
      return next;
    });
  };

  // Filtered menu logic
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return MENU_DATA.map((section) => {
      const filteredSubs = section.subcategories
        .map((sub) => {
          const matchingItems = sub.items.filter((item) => {
            const matchesQuery =
              !q ||
              item.name.toLowerCase().includes(q) ||
              (item.description && item.description.toLowerCase().includes(q)) ||
              (item.tag && item.tag.toLowerCase().includes(q)) ||
              sub.title.toLowerCase().includes(q);

            const matchesDietary =
              dietaryFilter === "all" ||
              item.dietary === dietaryFilter ||
              (dietaryFilter === "veg" && item.dietary === "vegan");

            const matchesWishlist = !showWishlistOnly || wishlist.has(item.id);

            return matchesQuery && matchesDietary && matchesWishlist;
          });

          return {
            ...sub,
            items: matchingItems,
          };
        })
        .filter((sub) => sub.items.length > 0);

      return {
        ...section,
        subcategories: filteredSubs,
      };
    }).filter((section) => section.subcategories.length > 0);
  }, [searchQuery, dietaryFilter, showWishlistOnly, wishlist]);

  const totalMatches = useMemo(() => {
    return filteredSections.reduce(
      (acc, s) => acc + s.subcategories.reduce((subAcc, sub) => subAcc + sub.items.length, 0),
      0
    );
  }, [filteredSections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -140;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const renderDietaryBadge = (dietary?: DietaryType) => {
    if (!dietary) return null;
    if (dietary === "veg") {
      return (
        <span
          title="Vegetarian"
          className="inline-flex items-center justify-center w-3.5 h-3.5 border border-emerald-600 rounded-[3px] p-[1.5px] shrink-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        </span>
      );
    }
    if (dietary === "vegan") {
      return (
        <span
          title="Vegan (Plant-based)"
          className="inline-flex items-center justify-center w-3.5 h-3.5 border border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-[3px] p-[1.5px] shrink-0 text-[8px] font-bold text-emerald-700 dark:text-emerald-400"
        >
          V
        </span>
      );
    }
    if (dietary === "egg") {
      return (
        <span
          title="Contains Egg"
          className="inline-flex items-center justify-center w-3.5 h-3.5 border border-amber-600 rounded-[3px] p-[1.5px] shrink-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
        </span>
      );
    }
    if (dietary === "non-veg") {
      return (
        <span
          title="Non-Vegetarian"
          className="inline-flex items-center justify-center w-3.5 h-3.5 border border-rose-600 rounded-[3px] p-[1.5px] shrink-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#F3E7D3] transition-colors duration-200 relative selection:bg-[#B72E35]/20 selection:text-[#B72E35]">
      {/* CSS Keyframes for Interactive Animations */}
      <style jsx global>{`
        @keyframes steamFloat {
          0% {
            transform: translateY(0px) scaleX(1);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-8px) scaleX(1.15);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-16px) scaleX(1.3);
            opacity: 0;
          }
        }
        @keyframes heartPulse {
          0% { transform: scale(1); }
          25% { transform: scale(1.35); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-steam-1 {
          animation: steamFloat 3.5s ease-in-out infinite;
        }
        .animate-steam-2 {
          animation: steamFloat 4.2s ease-in-out infinite 1.2s;
        }
        .animate-heart-pulse {
          animation: heartPulse 0.4s ease-out;
        }
        .animate-slide-up {
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up bg-[#241F1C] dark:bg-[#FAF4EB] text-[#F3E7D3] dark:text-[#241F1C] px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-serif font-medium border border-[#C9AE8B]/40">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── TOP HEADER ─── */}
      <header className="sticky top-0 z-40 bg-[#F3E7D3]/95 dark:bg-[#151110]/95 backdrop-blur-md border-b border-[#E2D7C7]/80 dark:border-stone-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Left: Home / Back Link */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden xs:inline font-serif">Back to Home</span>
          </Link>

          {/* Center: Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-9 sm:h-11 w-auto flex items-center shrink-0 transition-transform group-hover:scale-105 duration-300">
              <Image
                src="/logo-transparent.png"
                alt="smol café"
                width={659}
                height={975}
                className="h-9 sm:h-11 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/logo-dark-transparent.png"
                alt="smol café"
                width={584}
                height={858}
                className="h-9 sm:h-11 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                priority
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] leading-none group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors">
                smol café
              </span>
              <span className="font-mono text-[9px] sm:text-[10px] text-[#725039] dark:text-[#C9AE8B] tracking-wider uppercase mt-0.5">
                Upper Tapovan · Rishikesh
              </span>
            </div>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Wishlist toggle pill if items saved */}
            {wishlist.size > 0 && (
              <button
                type="button"
                onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-serif text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer ${
                  showWishlistOnly
                    ? "bg-[#B72E35] text-white shadow-md"
                    : "bg-[#FAF4EB] dark:bg-[#241F1C] text-[#B72E35] dark:text-purple-400 border border-[#B72E35]/40"
                }`}
                title="View your saved favorites"
              >
                <Heart className={`w-3.5 h-3.5 ${showWishlistOnly ? "fill-white" : "fill-current"}`} />
                <span>{wishlist.size} Saved</span>
              </button>
            )}

            {/* Download PDF Menu */}
            <a
              href="/smol-cafe-menu.pdf"
              download="Smol_Cafe_Rishikesh_Menu.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#FAF4EB] dark:bg-[#241F1C] hover:bg-white dark:hover:bg-stone-800 text-[#B72E35] dark:text-purple-400 border border-[#B72E35]/40 dark:border-purple-500/40 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full font-serif text-xs sm:text-sm font-semibold shadow-xs transition-all hover:scale-102 active:scale-95"
              title="Download Print Menu (PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF Menu</span>
            </a>

            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* ─── HERO INTRO WITH AMBIENT PARTICLES ─── */}
      <section className="relative px-4 sm:px-6 pt-8 pb-6 sm:pt-12 sm:pb-8 text-center max-w-4xl mx-auto overflow-hidden">
        {/* Soft Animated Himalayan Steam & Aurora Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#F2C84B]/20 dark:bg-purple-900/20 blur-3xl pointer-events-none rounded-full" />

        <div className="relative inline-flex items-center gap-2 bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B]/50 dark:border-stone-700/80 px-3.5 py-1 rounded-full shadow-xs mb-3 text-center">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B72E35] dark:bg-purple-500 animate-ping" />
          <span className="font-mono text-[11px] sm:text-xs font-semibold text-[#725039] dark:text-[#C9AE8B] tracking-wide">
            THE MENU · INSIDE SMOL DOOR
          </span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] leading-tight">
          eat something. meet someone.{" "}
          <span className="italic text-[#B72E35] dark:text-purple-400 relative inline-block">
            stay for a while.
            <span className="absolute -top-3 right-0 text-xs animate-steam-1 opacity-70">♨</span>
            <span className="absolute -top-4 -right-3 text-xs animate-steam-2 opacity-50">♨</span>
          </span>
        </h1>

        <p className="font-sans text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B] max-w-xl mx-auto mt-2 leading-relaxed">
          Artisanal coffees, spiced Kanpur bun makkhan, homestyle comfort bowls, wholesome thalis &amp; Himalayan herbal infusions.
        </p>

        {/* Visual Coffee Bean Divider */}
        <div className="flex items-center justify-center my-4">
          <Image
            src="/table-bean-divider.png"
            alt="coffee bean divider"
            width={162}
            height={31}
            className="h-2.5 sm:h-3 w-auto object-contain select-none dark:invert opacity-80"
          />
        </div>
      </section>

      {/* ─── STICKY SEARCH & FILTER TOOLBAR ─── */}
      <div className="sticky top-16 sm:top-20 z-30 bg-[#F3E7D3]/95 dark:bg-[#151110]/95 backdrop-blur-md border-b border-[#E2D7C7]/80 dark:border-stone-800/80 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-3">
          {/* Top Row: Search + Dietary Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input with Active Match Counter */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#725039] dark:text-[#C9AE8B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search coffee, chai, bun makkhan, dal, pasta..."
                className="w-full pl-9 pr-9 py-2 bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B]/60 dark:border-stone-700 rounded-full text-xs sm:text-sm text-[#241F1C] dark:text-[#F3E7D3] placeholder:text-[#725039]/60 dark:placeholder:text-[#C9AE8B]/60 focus:outline-none focus:border-[#B72E35] dark:focus:border-purple-500 shadow-inner transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[#725039] hover:text-[#241F1C] dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dietary Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: "all", label: "All Items" },
                  { id: "veg", label: "🌱 Pure Veg" },
                  { id: "egg", label: "🥚 Egg" },
                  { id: "vegan", label: "🌿 Vegan" },
                ] as const
              ).map((tab) => {
                const isActive = dietaryFilter === tab.id && !showWishlistOnly;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setDietaryFilter(tab.id);
                      setShowWishlistOnly(false);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#B72E35] text-white shadow-xs scale-102 font-semibold"
                        : "bg-[#FAF4EB] dark:bg-[#241F1C] text-[#725039] dark:text-[#C9AE8B] border border-[#C9AE8B]/50 hover:border-[#B72E35]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

              {/* Wishlist quick toggle button */}
              {wishlist.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                  className={`px-3 py-1.5 rounded-full text-xs font-serif font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    showWishlistOnly
                      ? "bg-[#B72E35] text-white shadow-xs font-semibold"
                      : "bg-[#FAF4EB] dark:bg-[#241F1C] text-[#B72E35] border border-[#B72E35]/40"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${showWishlistOnly ? "fill-white" : "fill-current"}`} />
                  <span>My Wishlist ({wishlist.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Quick Section Jump Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none border-t border-[#E2D7C7]/60 dark:border-stone-800/80">
            <div className="flex items-center gap-2">
              {MENU_DATA.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`px-3.5 py-1 rounded-full text-xs sm:text-sm font-serif font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#241F1C] text-[#F3E7D3] dark:bg-[#F3E7D3] dark:text-[#241F1C] shadow-xs scale-102"
                        : "text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-70">
                      {section.number}
                    </span>
                    <span>{section.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Matches Count */}
            <span className="hidden sm:inline-block font-mono text-[11px] text-[#725039]/80 dark:text-[#C9AE8B]/80 whitespace-nowrap">
              {totalMatches} dishes
            </span>
          </div>
        </div>
      </div>

      {/* ─── MAIN MENU CONTENT ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-14 sm:space-y-20">
        {filteredSections.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[#FAF4EB]/60 dark:bg-[#241F1C]/40 rounded-3xl border border-dashed border-[#C9AE8B]/60 dark:border-stone-700 animate-slide-up">
            <Coffee className="w-10 h-10 text-[#C9AE8B] mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
              {showWishlistOnly ? "No dishes in your wishlist yet" : "No dishes found"}
            </h3>
            <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] mt-1 max-w-sm mx-auto">
              {showWishlistOnly
                ? "Tap the ❤️ heart icon on any dish card to build your Tapovan feast wishlist!"
                : `We couldn't find anything matching "${searchQuery}". Try searching for "coffee", "paratha", or "thali".`}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDietaryFilter("all");
                setShowWishlistOnly(false);
              }}
              className="mt-4 px-5 py-2 bg-[#B72E35] hover:bg-[#9E242B] text-white rounded-full text-xs font-serif font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredSections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-36 sm:scroll-mt-40 space-y-8"
            >
              {/* Section Header */}
              <div className="border-b-2 border-[#241F1C] dark:border-[#F3E7D3] pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#B72E35] dark:text-purple-400">
                      {section.number} / 03
                    </span>
                    <span className="text-[#C9AE8B]">·</span>
                    <span className="font-mono text-xs uppercase tracking-wider text-[#725039] dark:text-[#C9AE8B]">
                      {section.subtitle}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#241F1C] dark:text-[#F3E7D3] tracking-tight mt-0.5">
                    {section.title}
                  </h2>
                </div>

                {/* Interactive Thali Mode Switcher in Section 03 */}
                {section.id === "meals-thalis" && (
                  <div className="flex items-center gap-1.5 bg-[#FAF4EB] dark:bg-[#241F1C] p-1 rounded-full border border-[#C9AE8B]/60 dark:border-stone-700 shadow-xs mt-2 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => setThaliViewMode("both")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-serif transition-all cursor-pointer ${
                        thaliViewMode === "both"
                          ? "bg-[#241F1C] text-[#F3E7D3] dark:bg-[#F3E7D3] dark:text-[#241F1C] font-semibold"
                          : "text-[#725039] dark:text-[#C9AE8B]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setThaliViewMode("bowl")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-serif transition-all cursor-pointer ${
                        thaliViewMode === "bowl"
                          ? "bg-[#B72E35] text-white font-semibold"
                          : "text-[#725039] dark:text-[#C9AE8B]"
                      }`}
                    >
                      🍲 Rice Bowls
                    </button>
                    <button
                      type="button"
                      onClick={() => setThaliViewMode("thali")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-serif transition-all cursor-pointer ${
                        thaliViewMode === "thali"
                          ? "bg-[#B72E35] text-white font-semibold"
                          : "text-[#725039] dark:text-[#C9AE8B]"
                      }`}
                    >
                      🍱 Complete Thalis
                    </button>
                  </div>
                )}
              </div>

              {/* Subcategories Grid */}
              <div className="space-y-10 sm:space-y-14">
                {section.subcategories.map((sub) => (
                  <div key={sub.id} className="space-y-4">
                    {/* Subcategory Title */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#E2D7C7] dark:border-stone-800 pb-2">
                      <div className="flex items-center gap-2">
                        {sub.icon && (
                          <span className="text-lg sm:text-xl select-none">
                            {sub.icon}
                          </span>
                        )}
                        <div>
                          <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241F1C] dark:text-[#F3E7D3] flex items-center gap-2">
                            <span>{sub.title}</span>
                            {sub.badge && (
                              <span className="text-[10px] font-mono uppercase bg-[#F2C84B]/20 text-[#725039] dark:text-[#F2C84B] px-2 py-0.5 rounded-full border border-[#F2C84B]/40">
                                {sub.badge}
                              </span>
                            )}
                          </h3>
                          {sub.subtitle && (
                            <p className="font-sans text-xs text-[#725039] dark:text-[#C9AE8B]">
                              {sub.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Bun Makkhan Flavour Selector in Bun Makkhan subcategory */}
                    {sub.id === "bun-makkhan" && (
                      <div className="p-3.5 rounded-2xl bg-[#EBDDC8]/60 dark:bg-[#2A231E]/60 border border-[#C9AE8B]/60 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
                        <div className="space-y-0.5">
                          <span className="font-serif text-xs sm:text-sm font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                            🫖 Live Combo Builder:
                          </span>
                          <p className="text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                            Select flavour for your Bun Makkhan + Masala Chai Combo (₹100):
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {["Honey & Jaggery", "Pineapple", "Orange", "Kanpur Masala"].map((flavor) => (
                            <button
                              key={flavor}
                              type="button"
                              onClick={() => {
                                setSelectedBunFlavor(flavor);
                                triggerToast(`Selected "${flavor}" Bun Makkhan + Chai Combo (₹100)`);
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs font-serif transition-all cursor-pointer ${
                                selectedBunFlavor === flavor
                                  ? "bg-[#B72E35] text-white shadow-xs font-semibold scale-102"
                                  : "bg-[#FAF4EB] dark:bg-[#241F1C] text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B]/60 hover:border-[#B72E35]"
                              }`}
                            >
                              {flavor}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Items Grid with Interactive Cards & Micro-interactions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {sub.items.map((item) => {
                        const isFavorited = wishlist.has(item.id);

                        // Dynamic display price based on Thali toggle
                        let displayPrice = item.price;
                        if (item.bowlPrice && item.thaliPrice) {
                          if (thaliViewMode === "bowl") {
                            displayPrice = `Bowl ₹${item.bowlPrice}`;
                          } else if (thaliViewMode === "thali") {
                            displayPrice = `Thali ₹${item.thaliPrice}`;
                          }
                        }

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItemModal(item)}
                            className="group relative p-3.5 sm:p-4 rounded-2xl bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#E2D7C7] dark:border-stone-800/90 hover:border-[#B72E35]/60 dark:hover:border-purple-500/60 transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between gap-2 overflow-hidden"
                          >
                            {/* Subtle Ambient Hover Glow */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#B72E35]/5 dark:bg-purple-600/5 rounded-full blur-2xl group-hover:bg-[#B72E35]/15 transition-all duration-500 pointer-events-none" />

                            {/* Item Header: Name, Dietary Dot, Price */}
                            <div className="flex items-start justify-between gap-3 relative z-10">
                              <div className="space-y-0.5 flex-1 pr-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {renderDietaryBadge(item.dietary)}
                                  <h4 className="font-serif text-base sm:text-lg font-bold text-[#241F1C] dark:text-[#F3E7D3] group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors">
                                    {item.name}
                                  </h4>
                                </div>
                                {item.description && (
                                  <p className="text-xs sm:text-[13px] text-[#725039] dark:text-[#C9AE8B] leading-relaxed line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              {/* Price Badge + Favorite Button */}
                              <div className="flex flex-col items-end shrink-0 gap-1.5">
                                <span className="font-mono text-sm sm:text-base font-bold text-[#241F1C] dark:text-[#F3E7D3] group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors">
                                  {displayPrice}
                                </span>

                                <div className="flex items-center gap-1">
                                  {item.tag && (
                                    <span className="text-[10px] font-mono text-[#B72E35] dark:text-purple-400 font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#B72E35]/10 dark:bg-purple-500/20">
                                      {item.tag}
                                    </span>
                                  )}

                                  {/* Wishlist Heart Toggle */}
                                  <button
                                    type="button"
                                    onClick={(e) => toggleWishlist(item.id, item.name, e)}
                                    className={`p-1.5 rounded-full transition-all cursor-pointer ${
                                      isFavorited
                                        ? "text-rose-500 bg-rose-50 dark:bg-rose-950/40 scale-110"
                                        : "text-[#725039]/50 hover:text-rose-500 hover:bg-stone-200/50 dark:hover:bg-stone-800"
                                    }`}
                                    title={isFavorited ? "Remove from wishlist" : "Save to wishlist"}
                                  >
                                    <Heart
                                      className={`w-3.5 h-3.5 ${isFavorited ? "fill-rose-500" : ""}`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Micro-interaction hint: Click for details */}
                            <div className="flex items-center justify-between text-[11px] text-[#725039]/60 dark:text-[#C9AE8B]/60 pt-1 border-t border-[#E2D7C7]/40 dark:border-stone-800/60 font-mono">
                              <span className="truncate max-w-[200px]">
                                {item.pairWith ? `✨ Pairs with ${item.pairWith}` : "Tap for tasting notes"}
                              </span>
                              <span className="group-hover:translate-x-1 transition-transform text-[#B72E35] dark:text-purple-400 font-bold">
                                Details →
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Highlight Box (Combo / Add-on Special) */}
                    {sub.highlight && (
                      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#EBDDC8]/80 dark:bg-[#2A231E]/80 border border-[#C9AE8B]/80 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg">⭐</span>
                          <div>
                            <h5 className="font-serif text-sm sm:text-base font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                              {sub.highlight.title}
                            </h5>
                            <p className="text-xs text-[#725039] dark:text-[#C9AE8B] leading-snug">
                              {sub.highlight.description}
                            </p>
                          </div>
                        </div>
                        <div className="self-end sm:self-center font-mono text-sm sm:text-base font-bold text-[#B72E35] dark:text-purple-400 bg-[#FAF4EB] dark:bg-black/30 px-3 py-1 rounded-full border border-[#C9AE8B]/40">
                          {sub.highlight.price}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* ─── INTERACTIVE DISH DETAIL PREVIEW MODAL ─── */}
      {selectedItemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedItemModal(null)}
        >
          <div
            className="relative w-full max-w-lg bg-[#FAF4EB] dark:bg-[#1E1917] rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#C9AE8B]/70 dark:border-stone-700 text-[#241F1C] dark:text-[#F3E7D3] space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {renderDietaryBadge(selectedItemModal.dietary)}
                  <span className="font-mono text-xs uppercase text-[#B72E35] dark:text-purple-400 font-bold tracking-wider">
                    {selectedItemModal.tag || "Smol Signature"}
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold">
                  {selectedItemModal.name}
                </h3>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedItemModal(null)}
                className="p-1.5 rounded-full bg-stone-200/60 dark:bg-stone-800 text-[#725039] hover:text-[#241F1C] dark:text-stone-300 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-sm sm:text-base text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
              {selectedItemModal.description}
            </p>

            {/* Notes & Preparation info */}
            {selectedItemModal.notes && (
              <div className="p-3.5 rounded-2xl bg-[#F3E7D3] dark:bg-[#2A231E] border border-[#C9AE8B]/40 dark:border-stone-800 space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-[#725039] dark:text-[#C9AE8B] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#F2C84B]" />
                  Preparation &amp; Taste Notes:
                </span>
                <p className="text-xs text-[#241F1C] dark:text-[#F3E7D3] leading-relaxed">
                  {selectedItemModal.notes}
                </p>
              </div>
            )}

            {/* Best Pairing Suggestion */}
            {selectedItemModal.pairWith && (
              <div className="flex items-center gap-2 text-xs text-[#725039] dark:text-[#C9AE8B] font-mono">
                <span>✨ Best Paired with:</span>
                <span className="font-bold text-[#B72E35] dark:text-purple-400">
                  {selectedItemModal.pairWith}
                </span>
              </div>
            )}

            {/* Price & Action Row */}
            <div className="pt-2 border-t border-[#E2D7C7] dark:border-stone-800 flex items-center justify-between gap-3">
              <div>
                <span className="block font-mono text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                  Price
                </span>
                <span className="font-mono text-2xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                  {selectedItemModal.price}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={() => toggleWishlist(selectedItemModal.id, selectedItemModal.name)}
                  className={`px-4 py-2.5 rounded-full font-serif text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    wishlist.has(selectedItemModal.id)
                      ? "bg-rose-500 text-white shadow-md"
                      : "bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B] text-[#725039] dark:text-[#C9AE8B] hover:border-rose-400"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${wishlist.has(selectedItemModal.id) ? "fill-white" : ""}`} />
                  <span>
                    {wishlist.has(selectedItemModal.id) ? "Saved to Wishlist" : "Save Dish"}
                  </span>
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(
                        `${selectedItemModal.name} (${selectedItemModal.price}) at smol café, Upper Tapovan Rishikesh!`
                      );
                      triggerToast(`Copied details for "${selectedItemModal.name}"!`);
                    }
                  }}
                  className="p-2.5 rounded-full bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B] text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] transition-colors cursor-pointer"
                  title="Copy details to share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOATING SCROLL TO TOP BUTTON ─── */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 cursor-pointer animate-slide-up"
          aria-label="Scroll to top of menu"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* ─── BOTTOM CTA & VISIT BANNER ─── */}
      <section className="bg-[#F3E7D3] dark:bg-[#151110] border-t border-[#E2D7C7]/80 dark:border-stone-800/80 py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-[#725039] dark:text-[#C9AE8B] tracking-wider">
            <MapPin className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
            <span>Visit Us in Upper Tapovan</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
            Fresh Bakes, Coffee &amp; Quiet Conversations
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B] max-w-lg mx-auto leading-relaxed">
            Smol Door, Upper Tapovan, Rishikesh, Uttarakhand 249192.
            <br />
            Open Every Day · 8:00 AM – 10:30 PM.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={SMOL_CAFE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-serif font-semibold text-xs sm:text-sm shadow-md transition-all hover:scale-102 active:scale-95 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Get Directions to Smol Door</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <a
              href="/smol-cafe-menu.pdf"
              download="Smol_Cafe_Rishikesh_Menu.pdf"
              className="inline-flex items-center gap-2 bg-[#FAF4EB] dark:bg-[#241F1C] hover:bg-white dark:hover:bg-stone-800 text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B] dark:border-stone-700 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-serif font-semibold text-xs sm:text-sm shadow-xs transition-all hover:scale-102 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
              <span>Download PDF Menu</span>
            </a>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-serif font-semibold text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 px-4 py-2 transition-colors cursor-pointer"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── COMPACT FOOTER ─── */}
      <footer className="border-t border-[#E2D7C7]/60 dark:border-stone-800/80 py-6 px-4 text-center font-mono text-[11px] text-[#725039]/70 dark:text-[#C9AE8B]/70">
        <p>© {new Date().getFullYear()} smol café · Tapovan, Rishikesh · Handcrafted with love.</p>
      </footer>
    </div>
  );
};
