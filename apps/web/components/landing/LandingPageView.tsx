"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Coffee,
  BookOpen,
  Music,
  MapPin,
  Clock,
  Wifi,
  Heart,
  Sparkles,
  ArrowRight,
  Star,
  ExternalLink,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  Calendar,
  Compass,
  Volume2,
  Users,
  CheckCircle2,
  Ticket,
  Send,
  AlertCircle,
  Tag,
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Film,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import PolaroidLineCarousel from "@/components/ui/polaroid-line-carousel";
import { SMOL_CAFE_MAPS_URL } from "@/lib/constants";
import {
  fetchUpcomingEventsAction,
  registerEventRsvpAction,
  type CustomerEventView,
} from "@/app/events/actions";

interface CuratedEvent {
  id: string;
  title: string;
  category: string;
  timeLabel: string;
  location: string;
  description: string;
  capacity: number;
  rsvpCount: number;
  badgeBg: string;
}

const CURATED_DEFAULT_EVENTS: CuratedEvent[] = [
  {
    id: "curated-acoustic-jam",
    title: "Acoustic Sunset Jam & Himalayan Strings",
    category: "Live Music & Strings",
    timeLabel: "Every Friday & Sunday · 6:30 PM – 8:30 PM",
    location: "Upper Balcony & Sunset Terrace",
    description: "An intimate sundowner session with acoustic guitars, gentle sitar melodies, and warm ginger-tulsi pour-overs as twilight settles across the mountains.",
    capacity: 18,
    rsvpCount: 12,
    badgeBg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
  },
  {
    id: "curated-poetry-circle",
    title: "Tapovan Spoken Word & Himalayan Poetry Circle",
    category: "Poetry & Storytelling",
    timeLabel: "Every Tuesday · 7:00 PM – 8:45 PM",
    location: "The Living Library (Reading Alcove)",
    description: "Candlelit readings of Rumi, Kabir, Rilke, and original handwritten verses. Bring a journal, an open heart, or just listen over warm artisanal cocoa.",
    capacity: 16,
    rsvpCount: 9,
    badgeBg: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
  },
  {
    id: "curated-book-swap",
    title: "Smol Book Swap & Slow Sunday Chess",
    category: "Books & Community",
    timeLabel: "Every Saturday & Sunday · 11:00 AM – 2:00 PM",
    location: "Library Sunroom & Garden Alcove",
    description: "Bring a pre-loved paperback to trade, play leisurely wooden chess games, and enjoy slow cold brews under the Himalayan morning sunlight.",
    capacity: 20,
    rsvpCount: 14,
    badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
  },
  {
    id: "curated-pourover-masterclass",
    title: "Sensory Pour-Over & Coffee Ritual Masterclass",
    category: "Coffee Workshop",
    timeLabel: "Every Saturday · 4:00 PM – 5:15 PM",
    location: "Specialty Pour-Over Bar",
    description: "Discover origin profiles, grind science, and manual V60 bloom rituals with our head barista. Includes 3 comparative single-origin tastings.",
    capacity: 10,
    rsvpCount: 7,
    badgeBg: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800",
  },
];

const COFFEE_CRAFTS = [
  {
    title: "Single-Origin Pour Over",
    method: "V60 / Chemex Manual Drip",
    desc: "Delicate high-altitude beans sourced from Himalayan foothills. Gentle floral aroma, bright citrus highlights, and a clean, silky finish.",
    highlight: "Light & Floral",
  },
  {
    title: "Himalayan Pink Salt Cortado",
    method: "Double Ristretto + Microfoam",
    desc: "Equal parts intense dark roast ristretto and velvety steamed milk, finished with a pinch of hand-mined pink rock salt to unlock natural sweetness.",
    highlight: "Smooth & Bold",
  },
  {
    title: "18-Hour Slow Cold Brew",
    method: "Cold Immersion Steep",
    desc: "Brewed overnight in cold mountain spring water with hints of dried orange peel and dark cocoa. Naturally low acidity, deeply refreshing.",
    highlight: "Rich & Refreshing",
  },
  {
    title: "Artisanal Espresso Bar",
    method: "Custom 9-Bar Extraction",
    desc: "Every shot is weighed and ground fresh per order. Golden crema with complex caramel and roasted hazelnut undertones.",
    highlight: "Pure Intensity",
  },
];

const REVIEWS = [
  {
    name: "Aarav Mehta",
    role: "Software Architect & Nomad",
    text: "The best specialty coffee in Rishikesh without question. Fast Wi-Fi, mountain sunlight streaming through big arched windows, and the quietest sanctuary to read or create in Tapovan.",
    stars: 5,
  },
  {
    name: "Elena Rostova",
    role: "Yoga Instructor & Traveler",
    text: "Smol café feels like a warm embrace after morning sadhana by the Ganga. The peaceful energy, beautiful ceramic mugs, and curated library make hours slip by effortlessly.",
    stars: 5,
  },
  {
    name: "Kabir Sengupta",
    role: "Writer & Photographer",
    text: "Their day-to-night transformation is pure poetry. Golden light across rustic wooden tables by afternoon, warm amber glow and acoustic jazz by dusk. Soulful café culture at its finest.",
    stars: 5,
  },
];

const FAQS = [
  {
    q: "Where in Rishikesh is smol café located?",
    a: "We are situated in Upper Tapovan on Badrinath Road, just 2 minutes walking distance above the walking trail to Lakshman Jhula, with sweeping views of the Ganga valley and surrounding forested Shivalik hills.",
  },
  {
    q: "What are your opening hours?",
    a: "We are open 7 days a week from 7:30 AM to 11:00 PM. Morning pour-overs and serene reading hours begin at 7:30 AM; twilight lounge music and evening conversations continue till 11:00 PM.",
  },
  {
    q: "Is smol café suitable for remote work or reading?",
    a: "Yes, absolutely! We designed the space as a literary haven and creative sanctuary with high-speed fiber Wi-Fi, accessible universal power outlets at wooden seating booths, and a calm, music-filled atmosphere.",
  },
  {
    q: "Can I borrow or exchange books from your library?",
    a: "Yes! Our Living Library holds over 450 volumes covering philosophy, Himalayan folklore, poetry, art, and fiction. You are welcome to read here, borrow during your stay in Rishikesh, or participate in our 'take a book, leave a book' swap.",
  },
  {
    q: "Are pets allowed at the café?",
    a: "We are completely pet-friendly! Mountain dogs and traveling four-legged companions are always welcomed warmly with fresh mountain spring water bowls.",
  },
];

interface CommunityMediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  caption: string;
  alt: string;
}

const COMMUNITY_MEDIA: CommunityMediaItem[] = [
  {
    id: "cm-1",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.35%20(1).jpeg",
    caption: "Slow mornings on the wooden deck",
    alt: "Smol Cafe morning community moments in Tapovan",
  },
  {
    id: "cm-2",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.36.jpeg",
    caption: "Handcrafted pour-over in progress",
    alt: "Single origin brewing at Smol Cafe Tapovan",
  },
  {
    id: "cm-3",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.07.jpeg",
    caption: "Laughter & stories over slow coffee",
    alt: "Travelers connecting at Smol Cafe Rishikesh",
  },
  {
    id: "cm-4",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.40%20(1).jpeg",
    caption: "Quiet corners with mountain poetry",
    alt: "Reading corner at Smol Cafe Tapovan",
  },
  {
    id: "cm-5",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.39.jpeg",
    caption: "Tapovan wanderers resting their feet",
    alt: "Nomads and wanderers at Smol Cafe",
  },
  {
    id: "cm-6",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.07%20(1).jpeg",
    caption: "Fairy lights and evening warmth",
    alt: "Evening ambience at Smol Cafe Tapovan",
  },
  {
    id: "cm-8",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.39%20(1).jpeg",
    caption: "The Living Library book exchange",
    alt: "Living library bookshelf at Smol Cafe",
  },
  {
    id: "cm-10",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.04%20(1).jpeg",
    caption: "Warm conversations that linger",
    alt: "Friendly cafe conversations at Smol",
  },
  {
    id: "cm-11",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.03%20(1).jpeg",
    caption: "Four-legged friends of Tapovan",
    alt: "Friendly dogs welcomed at Smol Cafe",
  },
  {
    id: "cm-12",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.06.jpeg",
    caption: "Golden hour on the veranda",
    alt: "Golden hour sunset at Smol Cafe Rishikesh",
  },
  {
    id: "cm-13",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.56.00.jpeg",
    caption: "Community gathering under the stars",
    alt: "Night gathering at Smol Cafe Tapovan",
  },
  {
    id: "cm-14",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.05.jpeg",
    caption: "Artisanal latte art by our baristas",
    alt: "Latte art at Smol Cafe",
  },
  {
    id: "cm-15",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.35.jpeg",
    caption: "Peaceful sanctuary for writers & nomads",
    alt: "Cozy work nook at Smol Cafe Tapovan",
  },
  {
    id: "cm-16",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.03.jpeg",
    caption: "Mountain pauses & friendly hellos",
    alt: "Travelers smiling at Smol Cafe",
  },
  {
    id: "cm-17",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.05%20(1).jpeg",
    caption: "Shared plates and honest smiles",
    alt: "Food and community at Smol Cafe",
  },
  {
    id: "cm-19",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.41.jpeg",
    caption: "The scent of freshly bloomed coffee",
    alt: "Fresh coffee brewing at Smol Cafe",
  },
  {
    id: "cm-20",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.52%20(1).jpeg",
    caption: "Deep valley breezes from our windows",
    alt: "Tapovan valley view from Smol Cafe",
  },
  {
    id: "cm-21",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.01%20(1).jpeg",
    caption: "Cozy evenings, candles, and acoustic chords",
    alt: "Candlelit acoustic night at Smol Cafe",
  },
  {
    id: "cm-22",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.07.06%20(1).jpeg",
    caption: "Smiles across borders and languages",
    alt: "Global travelers community at Smol Cafe",
  },
  {
    id: "cm-23",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.45.jpeg",
    caption: "Slow living in the Rishikesh foothills",
    alt: "Rishikesh mountain lifestyle at Smol Cafe",
  },
  {
    id: "cm-24",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.51.jpeg",
    caption: "The quiet warmth of belonging",
    alt: "Belonging at Smol Cafe Tapovan",
  },
  {
    id: "cm-25",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.06.56.jpeg",
    caption: "Tea, pour-overs & slow journal notes",
    alt: "Journaling and reading at Smol Cafe",
  },
  {
    id: "cm-26",
    type: "image",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.06.53.jpeg",
    caption: "A welcoming hearth for all who wander",
    alt: "Welcoming vibe at Smol Cafe Tapovan",
  },
  {
    id: "cm-27",
    type: "video",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Video%202026-10-16%20at%2017.14.33.mp4",
    caption: "Live Reel: Evening vinyl rhythms at the bar",
    alt: "Smol Cafe vinyl session video reel",
  },
  {
    id: "cm-28",
    type: "video",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Video%202026-10-16%20at%2017.13.50.mp4",
    caption: "Live Reel: The afternoon pour-over ritual",
    alt: "Smol Cafe pour over brewing video reel",
  },
  {
    id: "cm-29",
    type: "video",
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Video%202026-10-16%20at%2017.07.08.mp4",
    caption: "Live Reel: Gatherings, laughter & good vibes",
    alt: "Smol Cafe community gathering video reel",
  },
];

const HERO_SLIDES = [
  {
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.06.56.jpeg?updatedAt=1792223599429",
    alt: "Smol Café Interior overlooking Himalayan mountains and Ganges in Tapovan Rishikesh",
  },
  {
    url: "https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2017.06.53.jpeg?updatedAt=1792223599125",
    alt: "Smol Café Warm Hearth and Cozy Seating in Tapovan Rishikesh",
  },
];

export const LandingPageView: React.FC = () => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [istTime, setIstTime] = useState<string>("");

  // Hidden Staff Backdoor Access (Triple-tap on Logo + Ctrl/Cmd + Shift + S)
  const logoClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoClickCountRef = useRef(0);

  const handleSecretBackdoorTrigger = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([40, 30, 60]);
      } catch {}
    }
    router.push("/smol-backdoor");
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    logoClickCountRef.current += 1;
    if (logoClickCountRef.current >= 3) {
      e.preventDefault();
      if (logoClickTimeoutRef.current) clearTimeout(logoClickTimeoutRef.current);
      logoClickCountRef.current = 0;
      handleSecretBackdoorTrigger();
      return;
    }

    if (logoClickTimeoutRef.current) {
      clearTimeout(logoClickTimeoutRef.current);
    }
    logoClickTimeoutRef.current = setTimeout(() => {
      logoClickCountRef.current = 0;
    }, 1500);
  };

  // Keyboard shortcut: Ctrl + Shift + S or Cmd + Shift + S (Staff Backdoor)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        handleSecretBackdoorTrigger();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Hero Carousel State
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [heroTouchStartX, setHeroTouchStartX] = useState<number | null>(null);

  // Auto-rotate hero slides every 5.5s unless hovered
  useEffect(() => {
    if (isHeroHovered) return;
    const interval = setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isHeroHovered]);

  const nextHeroSlide = () => {
    setHeroSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const prevHeroSlide = () => {
    setHeroSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    setHeroTouchStartX(e.touches[0].clientX);
  };

  const handleHeroTouchEnd = (e: React.TouchEvent) => {
    if (heroTouchStartX === null) return;
    const diff = heroTouchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) nextHeroSlide();
      else prevHeroSlide();
    }
    setHeroTouchStartX(null);
  };

  // Events Popup Modal State
  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);
  const [liveDbEvents, setLiveDbEvents] = useState<CustomerEventView[]>([]);
  const [activeRsvpEventId, setActiveRsvpEventId] = useState<string | null>(null);
  const [rsvpGuestName, setRsvpGuestName] = useState("");
  const [rsvpGuestPhone, setRsvpGuestPhone] = useState("");
  const [rsvpPartySize, setRsvpPartySize] = useState<number>(1);
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpSuccessBanner, setRsvpSuccessBanner] = useState<string | null>(null);
  const [rsvpErrorBanner, setRsvpErrorBanner] = useState<string | null>(null);
  const [confirmedRsvps, setConfirmedRsvps] = useState<
    Record<string, { name: string; partySize: number; at: string }>
  >({});

  // Community Section & Lightbox State
  const [communityFilter, setCommunityFilter] = useState<"all" | "photos" | "videos">("all");
  const [communityViewMode, setCommunityViewMode] = useState<"clothesline" | "grid">("clothesline");
  const [showAllCommunity, setShowAllCommunity] = useState<boolean>(false);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  // Sync dark theme state for dynamic canvas & SVG styling
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    window.addEventListener("smol_theme_changed", checkTheme);
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("smol_theme_changed", checkTheme);
      observer.disconnect();
    };
  }, []);

  // Real-time IST clock update
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
        }).format(now);
        setIstTime(formatted);
      } catch (e) {
        setIstTime("7:30 AM – 11:00 PM IST");
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Body scroll lock & Escape key handler for Events Popup Modal
  useEffect(() => {
    if (isEventsModalOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsEventsModalOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isEventsModalOpen]);

  // Load real upcoming events from server action when modal opens
  useEffect(() => {
    if (isEventsModalOpen) {
      fetchUpcomingEventsAction()
        .then((res) => {
          if (res?.success && res.events && res.events.length > 0) {
            setLiveDbEvents(res.events);
          }
        })
        .catch(() => {
          // Gracefully continue with curated events
        });
    }
  }, [isEventsModalOpen]);

  // RSVP Form Submission Handler
  const handleRsvpSubmit = async (eventId: string, eventTitle: string) => {
    if (!rsvpGuestName.trim()) {
      setRsvpErrorBanner("Please enter your name to confirm your spot.");
      return;
    }
    setIsSubmittingRsvp(true);
    setRsvpErrorBanner(null);

    try {
      const isDb = liveDbEvents.some((e) => e.id === eventId);
      if (isDb) {
        await registerEventRsvpAction(eventId, rsvpGuestName.trim(), rsvpGuestPhone.trim());
      }

      setConfirmedRsvps((prev) => ({
        ...prev,
        [eventId]: {
          name: rsvpGuestName.trim(),
          partySize: rsvpPartySize,
          at: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "numeric" }),
        },
      }));

      setRsvpSuccessBanner(
        `Spot saved for ${rsvpGuestName.trim()} (${rsvpPartySize} ${rsvpPartySize > 1 ? "guests" : "guest"}) at "${eventTitle}"! See you at Smol.`
      );
      setActiveRsvpEventId(null);
      setRsvpGuestName("");
      setRsvpGuestPhone("");
      setRsvpPartySize(1);
    } catch {
      // Offline/Local confirmation fallback
      setConfirmedRsvps((prev) => ({
        ...prev,
        [eventId]: {
          name: rsvpGuestName.trim(),
          partySize: rsvpPartySize,
          at: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "numeric" }),
        },
      }));
      setRsvpSuccessBanner(
        `Spot saved for ${rsvpGuestName.trim()} at "${eventTitle}"! See you at Smol.`
      );
      setActiveRsvpEventId(null);
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  const handleCancelRsvp = (eventId: string) => {
    setConfirmedRsvps((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    setRsvpSuccessBanner(null);
  };

  // Filtered Community media
  const filteredCommunityMedia = COMMUNITY_MEDIA.filter((item) => {
    if (communityFilter === "photos") return item.type === "image";
    if (communityFilter === "videos") return item.type === "video";
    return true;
  });

  const displayedCommunityMedia =
    showAllCommunity || communityFilter === "videos"
      ? filteredCommunityMedia
      : filteredCommunityMedia.slice(0, 12);

  // Mapped slides for Polaroid Clothesline Carousel
  const communitySlides = filteredCommunityMedia.map((item) => ({
    image: item.url,
    title: item.caption,
    caption:
      item.type === "video"
        ? "🎥 Live Reel · Click to view with sound"
        : "📸 Tapovan Moment · Click to expand",
    alt: item.alt,
    type: item.type,
    isVideo: item.type === "video",
  }));

  const currentLightboxItem =
    activeLightboxIndex !== null && filteredCommunityMedia[activeLightboxIndex]
      ? filteredCommunityMedia[activeLightboxIndex]
      : null;

  // Lightbox keyboard and scroll lock
  useEffect(() => {
    if (activeLightboxIndex !== null) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setActiveLightboxIndex(null);
        } else if (e.key === "ArrowLeft") {
          setActiveLightboxIndex((prev) =>
            prev !== null && prev > 0 ? prev - 1 : filteredCommunityMedia.length - 1
          );
        } else if (e.key === "ArrowRight") {
          setActiveLightboxIndex((prev) =>
            prev !== null && prev < filteredCommunityMedia.length - 1 ? prev + 1 : 0
          );
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = isEventsModalOpen ? "hidden" : "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else if (!isEventsModalOpen) {
      document.body.style.overflow = "";
    }
  }, [activeLightboxIndex, isEventsModalOpen, filteredCommunityMedia.length]);

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#F3E7D3] transition-colors duration-300 selection:bg-[#B72E35]/20 selection:text-[#B72E35]">
      {/* ─── TOP STATUS ANNOUNCEMENT BAR ─── */}
      <div className="bg-[#241F1C] text-[#F3E7D3] text-xs font-mono py-1.5 sm:py-2 px-3 sm:px-4 border-b border-[#3A322D] relative z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-[#F2C84B] tracking-wide text-[11px] sm:text-xs shrink-0">
              TAPOVAN, RISHIKESH
            </span>
            <span className="text-stone-400 text-[11px] sm:text-xs truncate">
              • Open Daily 7:30 AM – 11:00 PM
            </span>
            <span className="hidden xl:inline text-stone-400 text-[11px]">
              • High-Speed Fiber Wi-Fi • 450+ Book Sanctuary
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {istTime && (
              <span className="text-[#C9AE8B] text-[10px] sm:text-[11px] bg-stone-800/80 px-2 py-0.5 rounded-full border border-stone-700/60 hidden sm:inline-block">
                🕒 {istTime} IST
              </span>
            )}
            <span className="text-[10px] sm:text-[11px] text-[#A3E0D2] font-mono bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
              Café Open
            </span>
          </div>
        </div>
      </div>

      {/* ─── STICKY NAVIGATION BAR ─── */}
      <header className="sticky top-0 z-40 bg-[#F3E7D3]/95 dark:bg-[#151110]/95 backdrop-blur-md border-b border-[#E2D7C7]/80 dark:border-stone-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 h-16 sm:h-[70px] flex items-center justify-between gap-3">
          {/* Logo & Brand Identity (Triple-tap unlocks /smol-backdoor) */}
          <Link
            href="/"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0 select-none"
            title="smol café"
          >
            <div className="relative h-11 sm:h-12 w-auto flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
              {/* Light Mode Logo: Arched Red Door */}
              <Image
                src="/logo-transparent.png"
                alt="smol café logo"
                width={659}
                height={975}
                className="h-10 sm:h-12 w-auto object-contain dark:hidden drop-shadow-xs"
                priority
              />
              {/* Dark Mode Logo: Glowing Neon Arched Door */}
              <Image
                src="/logo-dark-transparent.png"
                alt="smol café dark logo"
                width={584}
                height={858}
                className="h-10 sm:h-12 w-auto object-contain hidden dark:block drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]"
                priority
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-serif text-xl sm:text-2xl lg:text-[26px] font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] leading-none">
                  smol café
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#B72E35]/10 text-[#B72E35] dark:bg-purple-500/20 dark:text-purple-300 font-semibold border border-[#B72E35]/20 dark:border-purple-500/30 leading-none">
                  Rishikesh
                </span>
              </div>
              <span className="hidden xl:block font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] mt-0.5 tracking-wider">
                specialty coffee • living library • tapovan
              </span>
            </div>
          </Link>

          {/* Desktop & 1024px Laptop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-7 text-xs xl:text-sm font-medium">
            <Link
              href="#vibe"
              className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors whitespace-nowrap"
            >
              The Sanctuary
            </Link>
            <Link
              href="#coffee"
              className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors whitespace-nowrap"
            >
              Coffee Craft
            </Link>
            <Link
              href="#day-night"
              className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors whitespace-nowrap"
            >
              Day &amp; Night
            </Link>
            <Link
              href="#community"
              className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors whitespace-nowrap"
            >
              Community
            </Link>
            <Link
              href="#location"
              className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors whitespace-nowrap"
            >
              Visit Tapovan
            </Link>
            <button
              type="button"
              onClick={() => setIsEventsModalOpen(true)}
              className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
            >
              <span>🎙️</span>
              <span>Events</span>
            </button>
          </nav>

          {/* Action CTAs & Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle variant="icon" />

            <Link
              href="#location"
              className="hidden sm:inline-flex items-center gap-1.5 bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white px-3.5 lg:px-4 py-2 rounded-full font-medium text-xs lg:text-xs xl:text-sm shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Find Our Spot</span>
            </Link>

            {/* Mobile / Tablet Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-xl text-[#241F1C] dark:text-[#F3E7D3] hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Slide-down Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] px-4 sm:px-6 py-5 space-y-4 shadow-2xl animate-in slide-in-from-top-2 duration-200">
            {/* Drawer Brand Header (Triple-tap unlocks /smol-backdoor) */}
            <div
              onClick={handleLogoClick}
              className="flex items-center gap-2.5 pb-3 border-b border-[#E2D7C7]/60 dark:border-stone-800 cursor-pointer select-none"
            >
              <div className="relative h-9 w-auto flex items-center shrink-0">
                <Image
                  src="/logo-transparent.png"
                  alt="smol café"
                  width={659}
                  height={975}
                  className="h-9 w-auto object-contain dark:hidden"
                />
                <Image
                  src="/logo-dark-transparent.png"
                  alt="smol café"
                  width={584}
                  height={858}
                  className="h-9 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-lg font-bold text-[#241F1C] dark:text-[#F3E7D3] leading-none">
                  smol café
                </span>
                <span className="font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] mt-0.5">
                  Tapovan, Rishikesh
                </span>
              </div>
            </div>

            <nav className="flex flex-col space-y-3 font-medium text-sm sm:text-base">
              <Link
                href="#vibe"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 flex items-center gap-2"
              >
                📚 The Tapovan Sanctuary
              </Link>
              <Link
                href="#coffee"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 flex items-center gap-2"
              >
                ☕ Specialty Coffee Craft
              </Link>
              <Link
                href="#day-night"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 flex items-center gap-2"
              >
                🌗 Day to Night Transformation
              </Link>
              <Link
                href="#community"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 flex items-center gap-2"
              >
                👥 The Smol Community
              </Link>
              <Link
                href="#location"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 flex items-center gap-2"
              >
                📍 Location, Hours &amp; Directions
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsEventsModalOpen(true);
                }}
                className="py-1 text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 flex items-center gap-2 text-left w-full cursor-pointer"
              >
                🎙️ Events &amp; Poetry Gatherings
              </button>
            </nav>

            <div className="pt-2">
              <Link
                href="#location"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white text-center py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-4 h-4" />
                <span>Get Directions to Tapovan</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden pt-6 pb-12 sm:pt-10 sm:pb-20 lg:pt-14 lg:pb-24 px-3 sm:px-6">
        {/* Soft Ambient Himalayan Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none -z-10 opacity-30 dark:opacity-15 blur-3xl">
          <div className="absolute top-10 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[#F2C84B]/30 dark:bg-purple-900/30 rounded-full" />
          <div className="absolute top-20 right-1/4 w-80 sm:w-[420px] h-80 sm:h-[420px] bg-[#B72E35]/25 dark:bg-purple-600/25 rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Top Pill Badge */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B]/50 dark:border-stone-700/80 px-3.5 sm:px-4 py-1.5 rounded-full shadow-xs text-center">
              <span className="flex h-2 w-2 rounded-full bg-[#B72E35] dark:bg-purple-500 animate-ping shrink-0" />
              <span className="font-mono text-[11px] sm:text-xs font-semibold text-[#725039] dark:text-[#C9AE8B] tracking-wide">
                Upper Tapovan, Rishikesh • Literary Mountain Sanctuary
              </span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="text-center max-w-4xl mx-auto space-y-3 sm:space-y-5">
            <h1 className="font-serif text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-[62px] xl:text-7xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] leading-[1.12] sm:leading-[1.08]">
              Good Coffee, Slow Words &amp;{" "}
              <span className="italic font-serif text-[#B72E35] dark:text-purple-400 underline decoration-[#F2C84B]/80 dark:decoration-purple-400 decoration-wavy underline-offset-6 sm:underline-offset-8 hero-brighter-days transition-colors">
                Brighter Days.
              </span>
            </h1>
            <p className="font-sans text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl text-[#725039] dark:text-[#C9AE8B] max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">
              A warm, literary neighbourhood café nestled high above the bend of the holy Ganges in Tapovan.
              Handcrafted single-origin pour-overs, cozy bookshelves, and sunset acoustic sounds.
            </p>

            {/* CTAs */}
            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3.5 max-w-sm sm:max-w-none mx-auto w-full">
              <Link
                href="#vibe"
                className="bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-full font-semibold text-xs sm:text-sm md:text-base shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Explore The Sanctuary</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#location"
                className="bg-[#FAF4EB] dark:bg-[#241F1C] hover:bg-[#F3E7D3] dark:hover:bg-stone-800 text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B]/70 dark:border-stone-700 px-5 sm:px-6 py-3 sm:py-3.5 rounded-full font-mono text-xs sm:text-sm font-semibold shadow-xs hover:border-[#B72E35] dark:hover:border-purple-500 transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
                <span>Find Us in Tapovan</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsEventsModalOpen(true)}
                className="text-[#725039] dark:text-[#C9AE8B] hover:text-[#241F1C] dark:hover:text-purple-300 px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-full font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
                <span>Upcoming Events</span>
              </button>
            </div>

            {/* Micro Highlights strip */}
            <div className="pt-3 sm:pt-5 flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-[11px] sm:text-xs font-mono text-[#725039] dark:text-[#C9AE8B]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F2C84B]" /> 100% Single-Origin Arabica
              </span>
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-[#75AFA7]" /> High-Speed Optical Wi-Fi
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" /> 450+ Literary Book Swap
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" /> Pet &amp; Nomad Welcoming
              </span>
            </div>
          </div>

          {/* Hero Visual Frame */}
          <div className="mt-8 sm:mt-12 lg:mt-14 relative mx-auto max-w-5xl">
            <div
              className="group relative rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] overflow-hidden border-2 border-[#E2D7C7] dark:border-stone-800 shadow-xl bg-[#241F1C] select-none"
              onMouseEnter={() => setIsHeroHovered(true)}
              onMouseLeave={() => setIsHeroHovered(false)}
              onTouchStart={handleHeroTouchStart}
              onTouchEnd={handleHeroTouchEnd}
            >
              <div className="relative aspect-[4/3] xs:aspect-[16/11] sm:aspect-[16/10] lg:aspect-[16/9] w-full">
                {HERO_SLIDES.map((slide, idx) => (
                  <div
                    key={slide.url}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      idx === heroSlideIndex ? "opacity-100 z-0" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <Image
                      src={slide.url}
                      alt={slide.alt}
                      fill
                      priority={idx === 0}
                      sizes="(max-width: 768px) 100vw, 1200px"
                      className="object-cover object-center filter brightness-[0.96] contrast-[1.03] transition-transform duration-700 hover:scale-101"
                    />
                  </div>
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-[#151110]/85 via-black/10 to-transparent pointer-events-none z-[1]" />

                {/* Carousel Navigation Arrows */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevHeroSlide();
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg hover:scale-105 active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextHeroSlide();
                  }}
                  aria-label="Next photo"
                  className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg hover:scale-105 active:scale-95"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Carousel Indicator Dots */}
                <div className="absolute bottom-3 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 shadow-md">
                  {HERO_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHeroSlideIndex(idx);
                      }}
                      aria-label={`Switch to slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === heroSlideIndex
                          ? "w-6 bg-[#F2C84B]"
                          : "w-2 bg-white/50 hover:bg-white/90"
                      }`}
                    />
                  ))}
                </div>

                {/* Floating Widget 1: Roastery status */}
                <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-10 bg-white/90 dark:bg-black/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-white/40 dark:border-white/10 shadow-md flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#FDF0E7] dark:bg-purple-950/50 flex items-center justify-center text-[#B72E35] dark:text-purple-400 shrink-0">
                    <Coffee className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400 leading-tight">
                      Now Roasting
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                      Single-Origin Mountain Beans
                    </span>
                  </div>
                </div>

                {/* Floating Widget 2: Rating */}
                <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 bg-white/90 dark:bg-black/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-white/40 dark:border-white/10 shadow-md flex items-center gap-1.5 sm:gap-2">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                    ))}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-900 dark:text-stone-100 leading-none">
                      4.9 / 5.0
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-stone-500 dark:text-stone-400 hidden xs:inline">
                      2,400+ reviews
                    </span>
                  </div>
                </div>

                {/* Floating Widget 3: Bottom Banner Overlay (Desktop & Tablet) */}
                <div className="hidden sm:flex absolute bottom-3 sm:bottom-5 left-3 sm:left-5 right-3 sm:right-5 z-10 bg-white/95 dark:bg-[#1C1614]/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-white/40 dark:border-white/10 shadow-lg flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] sm:text-xs font-mono uppercase font-bold text-[#B72E35] dark:text-purple-400">
                        TAPOVAN SANCTUARY
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400">• Rishikesh, Uttarakhand</span>
                    </div>
                    <p className="font-serif text-sm sm:text-base lg:text-lg text-stone-900 dark:text-stone-100 italic">
                      “Sit softly. Drink deeply. The mountains have all the time in the world.”
                    </p>
                  </div>
                  <Link
                    href="#location"
                    className="shrink-0 bg-[#241F1C] dark:bg-[#F3E7D3] hover:bg-[#B72E35] dark:hover:bg-purple-600 text-[#F3E7D3] dark:text-[#241F1C] dark:hover:text-white px-3.5 sm:px-4 py-2 rounded-xl font-mono text-[11px] sm:text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span>Visit Us</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Mobile Quote Banner beneath the image */}
            <div className="sm:hidden mt-3 bg-[#FAF4EB] dark:bg-[#1E1917] rounded-2xl p-4 border border-[#E2D7C7] dark:border-stone-800 shadow-sm space-y-2 text-center">
              <span className="text-[10px] font-mono uppercase font-bold text-[#B72E35] dark:text-purple-400">
                TAPOVAN SANCTUARY
              </span>
              <p className="font-serif text-xs text-[#241F1C] dark:text-[#F3E7D3] italic">
                “Sit softly. Drink deeply. The mountains have all the time in the world.”
              </p>
              <Link
                href="#location"
                className="w-full bg-[#241F1C] dark:bg-[#F3E7D3] hover:bg-[#B72E35] dark:hover:bg-purple-600 text-[#F3E7D3] dark:text-[#241F1C] dark:hover:text-white py-2 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Visit Us in Tapovan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COFFEE CRAFT SHOWCASE ─── */}
      <section id="coffee" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 bg-[#FAF4EB]/70 dark:bg-[#1A1513]/70 border-y border-[#E2D7C7]/70 dark:border-stone-800/80">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-[#B72E35] dark:text-purple-400 font-semibold">
              The Pour-Over Bar
            </span>
            <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
              Specialty Coffee Craft
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B]">
              Every single cup is freshly ground upon order and brewed with precision water temperature and pure mountain spring water.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {COFFEE_CRAFTS.map((craft, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-[#201A18] border border-[#E2D7C7] dark:border-stone-800 shadow-xs flex flex-col justify-between space-y-3 group hover:border-[#B72E35]/60 dark:hover:border-purple-500/50 transition-all duration-300"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-[#B72E35] dark:text-purple-300 bg-[#B72E35]/10 dark:bg-purple-500/20 px-2.5 py-0.5 rounded-full">
                      {craft.highlight}
                    </span>
                    <Coffee className="w-4 h-4 text-[#725039] dark:text-[#C9AE8B] group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors" />
                  </div>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241F1C] dark:text-[#F3E7D3] pt-1">
                    {craft.title}
                  </h3>
                  <div className="text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B]">
                    {craft.method}
                  </div>
                  <p className="text-xs text-[#725039] dark:text-[#C9AE8B] leading-relaxed pt-1">
                    {craft.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE SMOL SANCTUARY / PILLARS ─── */}
      <section id="vibe" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-[#B72E35] dark:text-purple-400 font-semibold">
              The Living Philosophy
            </span>
            <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
              More Than A Café. A Haven.
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B]">
              Designed intentionally for thinkers, writers, weary mountain hikers, and slow travelers who seek peace and exceptional coffee.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Pillar 1 */}
            <div className="p-5 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-[#201A18] border border-[#E2D7C7] dark:border-stone-800 shadow-xs space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#B72E35]/10 dark:bg-purple-500/20 flex items-center justify-center text-[#B72E35] dark:text-purple-300">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                The Living Library
              </h3>
              <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
                Over 450 books spanning Himalayan folklore, poetry, existential philosophy, art catalogs, and classic fiction.
                Take a book, leave a book, or lose yourself in a chapter for hours.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-5 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-[#201A18] border border-[#E2D7C7] dark:border-stone-800 shadow-xs space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#75AFA7]/15 flex items-center justify-center text-[#2C5852] dark:text-[#A3E0D2]">
                <Wifi className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                Remote Work Sanctuary
              </h3>
              <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
                Dependable high-speed fiber Wi-Fi, accessible universal plugs at every wooden booth, natural Himalayan daylight,
                and respectful quiet background ambiance for deep creative focus.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-5 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-[#201A18] border border-[#E2D7C7] dark:border-stone-800 shadow-xs space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#754CFF]/15 flex items-center justify-center text-[#754CFF]">
                <Music className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                Rishikesh Soundsystem
              </h3>
              <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
                From morning sitar ragas and indie folk to evening low-fidelity jazz. Guests can even browse our curated music library
                and request ambient tunes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DAY & NIGHT DUALITY ─── */}
      <section id="day-night" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 bg-[#FAF4EB]/60 dark:bg-[#181311]/60 border-t border-[#E2D7C7] dark:border-stone-800">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-[#B72E35] dark:text-purple-400 font-semibold">
              Tapovan Rhythm
            </span>
            <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
              Day &amp; Night Personality
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B]">
              Smol transforms as the Himalayan sun dips behind the Ganga ridge. Experience both sides of our heartbeat.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
            {/* Day Card */}
            <div className="rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-[#1C1715] border-2 border-[#E2D7C7] dark:border-stone-800 overflow-hidden shadow-md flex flex-col justify-between">
              <div className="relative aspect-[16/10] sm:aspect-video w-full">
                <Image
                  src="https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.39.jpeg?updatedAt=1792223586024"
                  alt="Smol Cafe Sunlight & Brew Morning"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#F2C84B] text-[#241F1C] font-mono text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                  <Sun className="w-3.5 h-3.5" />
                  <span>SUNLIGHT &amp; BREW (7:30 AM – 5:30 PM)</span>
                </div>
              </div>
              <div className="p-5 sm:p-7 lg:p-8 space-y-3 sm:space-y-4">
                <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                  Bright, Crisp &amp; Inspiring
                </h3>
                <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
                  Morning yoga practitioners, mountain cyclists, and remote thinkers gathering for single-origin pour-overs,
                  gentle river breezes, and crisp Himalayan sunlight pouring across aged timber.
                </p>
                <div className="pt-1 flex flex-wrap gap-2 text-[11px] sm:text-xs font-mono text-[#725039] dark:text-[#C9AE8B]">
                  <span className="px-2.5 py-1 rounded-lg bg-[#F3E7D3] dark:bg-stone-800">☕ V60 Pour Overs</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#F3E7D3] dark:bg-stone-800">📖 Morning Reading</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#F3E7D3] dark:bg-stone-800">☀️ Ganga Breeze</span>
                </div>
              </div>
            </div>

            {/* Night Card */}
            <div className="rounded-2xl sm:rounded-3xl bg-[#241F1C] text-[#F3E7D3] border-2 border-stone-800 overflow-hidden shadow-md flex flex-col justify-between">
              <div className="relative aspect-[16/10] sm:aspect-video w-full">
                <Image
                  src="https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.35%20(1).jpeg?updatedAt=1792223575306"
                  alt="Smol Cafe Twilight & Vinyl Intimate Evening"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#754CFF] text-white font-mono text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                  <Moon className="w-3.5 h-3.5" />
                  <span>TWILIGHT &amp; VINYL (5:30 PM – 11:00 PM)</span>
                </div>
              </div>
              <div className="p-5 sm:p-7 lg:p-8 space-y-3 sm:space-y-4">
                <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  Intimate, Candlelit &amp; Soulful
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                  As dusk blankets the valley, warm amber fairy lights ignite. Acoustic chords float through the room,
                  warm herbal teas brew, and heartfelt conversations linger deep into the mountain night.
                </p>
                <div className="pt-1 flex flex-wrap gap-2 text-[11px] sm:text-xs font-mono text-stone-300">
                  <span className="px-2.5 py-1 rounded-lg bg-stone-800">🕯️ Candlelit Ambiance</span>
                  <span className="px-2.5 py-1 rounded-lg bg-stone-800">☕ Herbal Warmth</span>
                  <span className="px-2.5 py-1 rounded-lg bg-stone-800">🎷 Acoustic Jazz</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TODAY'S CHALK BLACKBOARD CARD ─── */}
      <section id="blackboard" className="py-12 sm:py-16 lg:py-20 px-3 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-[#1A1816] text-[#F3E7D3] p-6 sm:p-10 lg:p-12 rounded-2xl sm:rounded-[2.5rem] border-3 sm:border-4 border-[#725039]/70 shadow-2xl overflow-hidden">
            <div className="font-mono text-[10px] sm:text-[11px] text-[#C9AE8B] uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B72E35] dark:bg-purple-500 shrink-0" />
              <span>SMOL TAPOVAN BLACKBOARD • TODAY&apos;S CHALK</span>
            </div>

            <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6 text-center">
              <div className="font-chalk text-2xl xs:text-3xl sm:text-4xl md:text-5xl text-[#F2C84B] leading-snug px-2">
                “Sit softly. Drink deeply. The mountains have all the time in the world.”
              </div>
              <div className="h-0.5 w-16 sm:w-24 bg-[#C9AE8B]/40 mx-auto" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-left font-mono text-xs sm:text-sm text-stone-300 pt-1 sm:pt-2">
                <div className="p-3.5 sm:p-4 rounded-xl bg-stone-900/80 border border-stone-800">
                  <span className="text-[#FFAAA6] dark:text-purple-300 font-bold block mb-1 text-[11px] sm:text-xs">
                    ☕ BARISTA&apos;S NOTE
                  </span>
                  Today&apos;s special roast: High-Altitude Monsooned Malabar with notes of dried fruit &amp; dark cocoa. Slow dripped on V60.
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-stone-900/80 border border-stone-800">
                  <span className="text-[#A3E0D2] font-bold block mb-1 text-[11px] sm:text-xs">
                    🎶 TONIGHT&apos;S ACOUSTIC
                  </span>
                  Sunset vinyl session begins at 6:30 PM. Feel free to join in, sit softly, and immerse in mountain melodies.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CUSTOMER REVIEWS ─── */}
      <section className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 bg-[#FAF4EB]/60 dark:bg-[#181311]/60 border-t border-[#E2D7C7] dark:border-stone-800">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-1.5 sm:space-y-2">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-[#B72E35] dark:text-purple-400 font-semibold">
              Traveler &amp; Local Love
            </span>
            <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
              Notes from Wanderer Friends
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {REVIEWS.map((rev, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-[#1E1917] border border-[#E2D7C7] dark:border-stone-800 shadow-xs flex flex-col justify-between space-y-3 sm:space-y-4"
              >
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex text-amber-500">
                    {[...Array(rev.stars)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="font-serif italic text-sm sm:text-base lg:text-lg text-[#241F1C] dark:text-[#F3E7D3] leading-relaxed">
                    &ldquo;{rev.text}&rdquo;
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E2D7C7]/60 dark:border-stone-800">
                  <h4 className="font-sans font-bold text-xs sm:text-sm text-[#241F1C] dark:text-[#F3E7D3]">
                    {rev.name}
                  </h4>
                  <p className="text-[11px] sm:text-xs font-mono text-[#725039] dark:text-[#C9AE8B]">
                    {rev.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE SMOL COMMUNITY SECTION ─── */}
      <section id="community" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 bg-[#FAF4EB]/40 dark:bg-[#161210]/60 border-t border-[#E2D7C7] dark:border-stone-800">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B72E35]/10 dark:bg-purple-500/20 text-[#B72E35] dark:text-purple-300 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold border border-[#B72E35]/20 dark:border-purple-500/30">
              <Users className="w-3.5 h-3.5" />
              <span>Tapovan Sanctuary Tribe · 29 Moments</span>
            </div>
            <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
              The Smol Community
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
              Real souls from 40+ countries, local poets, mountain canines, and quiet conversations over manual pour-overs. Life unfiltered at Smol Café, Rishikesh.
            </p>

            {/* Filter Tabs & View Mode Switcher */}
            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setCommunityFilter("all")}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold transition-all cursor-pointer ${
                    communityFilter === "all"
                      ? "bg-[#B72E35] dark:bg-purple-600 text-white shadow-xs"
                      : "bg-[#FAF4EB] dark:bg-[#201A18] hover:bg-[#F3E7D3] dark:hover:bg-stone-800 text-[#725039] dark:text-[#C9AE8B] border border-[#C9AE8B]/40 dark:border-stone-800"
                  }`}
                >
                  All ({COMMUNITY_MEDIA.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommunityFilter("photos")}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold transition-all cursor-pointer ${
                    communityFilter === "photos"
                      ? "bg-[#B72E35] dark:bg-purple-600 text-white shadow-xs"
                      : "bg-[#FAF4EB] dark:bg-[#201A18] hover:bg-[#F3E7D3] dark:hover:bg-stone-800 text-[#725039] dark:text-[#C9AE8B] border border-[#C9AE8B]/40 dark:border-stone-800"
                  }`}
                >
                  📸 Photos ({COMMUNITY_MEDIA.filter((m) => m.type === "image").length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommunityFilter("videos")}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold transition-all cursor-pointer ${
                    communityFilter === "videos"
                      ? "bg-[#B72E35] dark:bg-purple-600 text-white shadow-xs"
                      : "bg-[#FAF4EB] dark:bg-[#201A18] hover:bg-[#F3E7D3] dark:hover:bg-stone-800 text-[#725039] dark:text-[#C9AE8B] border border-[#C9AE8B]/40 dark:border-stone-800"
                  }`}
                >
                  🎥 Reels ({COMMUNITY_MEDIA.filter((m) => m.type === "video").length})
                </button>
              </div>

              {/* View Switcher: Pegged Line vs Photo Wall */}
              <div className="inline-flex p-1 rounded-full bg-[#FAF4EB] dark:bg-[#201A18] border border-[#C9AE8B]/50 dark:border-stone-800 shadow-xs">
                <button
                  type="button"
                  onClick={() => setCommunityViewMode("clothesline")}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    communityViewMode === "clothesline"
                      ? "bg-[#B72E35] dark:bg-purple-600 text-white shadow-xs"
                      : "text-[#725039] dark:text-[#C9AE8B] hover:text-[#241F1C] dark:hover:text-white"
                  }`}
                  title="Interactive polaroids pegged to a swaying line"
                >
                  <span>🎞️ Pegged Line</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCommunityViewMode("grid")}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    communityViewMode === "grid"
                      ? "bg-[#B72E35] dark:bg-purple-600 text-white shadow-xs"
                      : "text-[#725039] dark:text-[#C9AE8B] hover:text-[#241F1C] dark:hover:text-white"
                  }`}
                  title="All prints laid out in a photo wall grid"
                >
                  <span>🖼️ Photo Wall</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW 1: Interactive Pegged Polaroid Line Carousel */}
          {communityViewMode === "clothesline" && (
            <div className="space-y-3">
              <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-b from-[#FAF4EB]/90 to-[#F5ECE0]/90 dark:from-[#1C1715]/95 dark:to-[#161210]/95 border border-[#E2D7C7] dark:border-stone-800/80 shadow-md isolate">
                {/* Top hint tag */}
                <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10 text-[11px] font-mono text-[#725039]/80 dark:text-[#C9AE8B]/80">
                  <span className="flex items-center gap-1.5 bg-[#FAF4EB]/85 dark:bg-stone-900/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#C9AE8B]/30 dark:border-stone-700/60 shadow-xs">
                    <Sparkles className="w-3 h-3 text-[#B72E35] dark:text-purple-400" />
                    <span>Pegged Instant Prints · Drag to swing & slide</span>
                  </span>
                  <span className="hidden md:inline-block bg-[#FAF4EB]/85 dark:bg-stone-900/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#C9AE8B]/30 dark:border-stone-700/60 shadow-xs">
                    Click any polaroid to enlarge
                  </span>
                </div>

                <PolaroidLineCarousel
                  slides={communitySlides}
                  height="clamp(460px, 62vh, 580px)"
                  cardWidth={285}
                  sag={46}
                  swing={1.15}
                  autoplay={4500}
                  string={isDarkTheme ? "#8C7765" : "#A28B71"}
                  background="transparent"
                  ink={isDarkTheme ? "#F3E7D3" : "#241F1C"}
                  accent={isDarkTheme ? "#9333ea" : "#B72E35"}
                  onCardClick={(idx) => setActiveLightboxIndex(idx)}
                  ariaLabel="Smol Cafe Community Moments & Reels"
                  className="w-full"
                />
              </div>

              {/* Sub-bar hint and toggle */}
              <div className="flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#725039] dark:text-[#C9AE8B] px-2 gap-2">
                <span>💡 Tip: Drag left/right with mouse or finger to feel the breeze swing</span>
                <button
                  type="button"
                  onClick={() => setCommunityViewMode("grid")}
                  className="text-[#B72E35] dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                >
                  Switch to Photo Wall View ({filteredCommunityMedia.length} moments) →
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: Photo Wall Grid */}
          {communityViewMode === "grid" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {displayedCommunityMedia.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveLightboxIndex(idx)}
                    className={`group relative aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${
                      item.type === "video"
                        ? "border-2 border-[#B72E35]/40 dark:border-purple-500/40 bg-black hover:border-[#B72E35] dark:hover:border-purple-500"
                        : "border border-[#E2D7C7] dark:border-stone-800 bg-[#241F1C] hover:border-[#B72E35]/50 dark:hover:border-purple-500/50"
                    }`}
                  >
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.url}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                        />
                        {/* Top Reel Badge */}
                        <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-xs z-10">
                          <Film className="w-3 h-3 text-[#B72E35] dark:text-purple-400" />
                          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-white tracking-wider">
                            Live Reel
                          </span>
                        </div>
                        {/* Center Play Button Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/55 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:bg-[#B72E35] dark:group-hover:bg-purple-600 transition-all duration-300">
                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <Image
                        src={item.url}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}

                    {/* Hover Caption Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 sm:p-4 flex flex-col justify-end z-20">
                      <span className="font-serif italic text-white text-xs sm:text-sm leading-snug drop-shadow-sm">
                        {item.caption}
                      </span>
                      <div className="flex items-center justify-between text-[10px] text-white/80 font-mono mt-1 pt-1 border-t border-white/20">
                        <span>Tapovan · smol</span>
                        <Maximize2 className="w-3.5 h-3.5 text-white/90" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Toggle View All / View Less button */}
              {communityFilter !== "videos" && filteredCommunityMedia.length > 12 && (
                <div className="pt-2 sm:pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllCommunity(!showAllCommunity)}
                    className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {showAllCommunity
                        ? "Show Fewer Moments"
                        : `Explore All ${filteredCommunityMedia.length} Moments & Reels`}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${
                        showAllCommunity ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── LOCATION, MAP & TIMINGS ─── */}
      <section id="location" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 border-t border-[#E2D7C7] dark:border-stone-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-5 space-y-4 sm:space-y-6">
              <div className="space-y-1.5 sm:space-y-2">
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-[#B72E35] dark:text-purple-400 font-semibold">
                  Find Us in the Foothills
                </span>
                <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
                  Tapovan, Rishikesh
                </h2>
                <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B]">
                  Perched high above the river, just moments from the suspension bridge trail. Easy to walk, hard to leave.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm font-sans">
                <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B]/40 dark:border-stone-800">
                  <MapPin className="w-5 h-5 text-[#B72E35] dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-[#241F1C] dark:text-[#F3E7D3]">Exact Address</span>
                    <span className="text-[#725039] dark:text-[#C9AE8B] text-xs sm:text-sm">
                      Badrinath Road, Upper Tapovan, Rishikesh, Uttarakhand 249192
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-stone-500 block mt-1">
                      Coordinates: 30.1310° N, 78.3248° E
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B]/40 dark:border-stone-800">
                  <Clock className="w-5 h-5 text-[#B72E35] dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-[#241F1C] dark:text-[#F3E7D3]">Opening Hours</span>
                    <span className="text-[#725039] dark:text-[#C9AE8B] text-xs sm:text-sm">
                      Monday to Sunday: 7:30 AM – 11:00 PM
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block mt-1">
                      Open 365 Days a Year • Walk-ins Always Welcome
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex flex-col xs:flex-row gap-2.5 sm:gap-3">
                <a
                  href={SMOL_CAFE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full xs:w-auto text-center justify-center bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setIsEventsModalOpen(true)}
                  className="w-full xs:w-auto text-center justify-center bg-[#FAF4EB] dark:bg-[#241F1C] hover:bg-[#F3E7D3] dark:hover:bg-stone-800 border border-[#C9AE8B] dark:border-stone-700 hover:border-[#B72E35] dark:hover:border-purple-500 text-[#241F1C] dark:text-[#F3E7D3] px-4 sm:px-5 py-2.5 sm:py-3 rounded-full font-mono text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
                  <span>Upcoming Events</span>
                </button>
              </div>
            </div>

            {/* Right Visual Image */}
            <div className="lg:col-span-7">
              <a
                href={SMOL_CAFE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Smol Café location on Google Maps"
                className="group block relative rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-[#E2D7C7] dark:border-stone-800 shadow-xl bg-stone-900 aspect-[16/10] sm:aspect-video lg:aspect-[16/10] cursor-pointer"
              >
                <Image
                  src="https://ik.imagekit.io/sonu2k1/Smol%20Cafe%20by%20Kuava%20Digitals/Landing-Page%20/WhatsApp%20Image%202026-10-16%20at%2016.55.37.jpeg?updatedAt=1792223589336"
                  alt="Smol Cafe Rishikesh Tapovan View"
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover filter contrast-105 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 sm:p-6 lg:p-8 flex flex-col justify-end">
                  <span className="font-mono text-[10px] sm:text-xs uppercase text-[#F2C84B] font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#F2C84B]" />
                    <span>Nestled in Nature · Tap to View on Maps</span>
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-0.5">
                    Smol Café · Tapovan Ridge
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-md">
                    2 minutes uphill from Lakshman Jhula path. Plentiful two-wheeler parking and peaceful mountain air.
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FREQUENTLY ASKED QUESTIONS ─── */}
      <section className="py-12 sm:py-16 lg:py-20 px-3 sm:px-6 bg-[#FAF4EB]/60 dark:bg-[#181311]/60 border-t border-[#E2D7C7] dark:border-stone-800">
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          <div className="text-center space-y-1.5 sm:space-y-2">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-[#B72E35] dark:text-purple-400 font-semibold">
              Curious Minds
            </span>
            <h2 className="font-serif text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl sm:rounded-2xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1E1917] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 font-serif text-base sm:text-lg lg:text-xl font-bold text-[#241F1C] dark:text-[#F3E7D3] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-[#B72E35] dark:text-purple-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] leading-relaxed border-t border-[#E2D7C7]/50 dark:border-stone-800 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── FOOTER (Responsive Theme & Unclipped Light/Dark Brand Logo) ─── */}
      <footer className="bg-[#FAF4EB] dark:bg-[#1C1715] text-[#725039] dark:text-[#C9AE8B] text-xs font-mono py-10 sm:py-12 px-4 sm:px-6 border-t border-[#E2D7C7] dark:border-stone-800 transition-colors">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Col 1: Brand */}
            <div className="space-y-2.5 sm:space-y-3 sm:col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
                <div className="relative h-11 sm:h-12 w-auto flex items-center shrink-0 transition-transform group-hover:scale-105">
                  {/* Light Mode Logo */}
                  <Image
                    src="/logo-transparent.png"
                    alt="smol café logo"
                    width={659}
                    height={975}
                    className="h-10 sm:h-11 w-auto object-contain dark:hidden drop-shadow-xs"
                  />
                  {/* Dark Mode Logo */}
                  <Image
                    src="/logo-dark-transparent.png"
                    alt="smol café dark logo"
                    width={584}
                    height={858}
                    className="h-10 sm:h-11 w-auto object-contain hidden dark:block drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-white group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors leading-none">
                    smol café
                  </span>
                  <span className="text-[10px] font-mono text-[#725039] dark:text-stone-400 mt-1">
                    Tapovan, Rishikesh
                  </span>
                </div>
              </Link>
              <p className="text-[11px] text-[#725039]/80 dark:text-stone-400 leading-relaxed font-sans max-w-xs">
                A warm, literary neighbourhood café with a day-to-night personality in Tapovan, Rishikesh.
              </p>
              <div className="text-[10px] text-[#725039]/60 dark:text-stone-500">
                Coordinates: 30.1310° N, 78.3248° E
              </div>
            </div>

            {/* Col 2: The Experience */}
            <div className="space-y-2">
              <h4 className="text-[#241F1C] dark:text-white font-bold uppercase text-[10px] sm:text-[11px] tracking-wider">The Experience</h4>
              <ul className="space-y-1.5 text-[#725039] dark:text-stone-400 text-xs">
                <li>
                  <Link href="#vibe" className="hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors">
                    📚 The Living Library
                  </Link>
                </li>
                <li>
                  <Link href="#coffee" className="hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors">
                    ☕ Specialty Pour-Over Bar
                  </Link>
                </li>
                <li>
                  <Link href="#day-night" className="hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors">
                    🌗 Day &amp; Night Personality
                  </Link>
                </li>
                <li>
                  <Link href="#community" className="hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors">
                    👥 Community Moments
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsEventsModalOpen(true)}
                    className="hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors cursor-pointer flex items-center gap-1.5 text-left"
                  >
                    🎙️ Upcoming Events
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Visit & Timings */}
            <div className="space-y-2">
              <h4 className="text-[#241F1C] dark:text-white font-bold uppercase text-[10px] sm:text-[11px] tracking-wider">Visit Tapovan</h4>
              <p className="text-[11px] text-[#725039] dark:text-stone-400 leading-relaxed font-sans">
                Upper Tapovan, Badrinath Road, Rishikesh, Uttarakhand 249192.
              </p>
              <div className="pt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                Open Daily: 7:30 AM – 11:00 PM
              </div>
              <div className="pt-1">
                <a
                  href={SMOL_CAFE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#B72E35] dark:text-purple-400 hover:underline font-semibold"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="pt-2">
                <ThemeToggle variant="pill" />
              </div>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-[#E2D7C7] dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#725039]/70 dark:text-stone-500 text-center sm:text-left">
            <div>
              © {new Date().getFullYear()} smol café · Tapovan, Rishikesh. All rights reserved.
            </div>
            <div className="flex items-center gap-3">
              <span>Good Coffee, Slow Words &amp; <span className="font-serif italic text-[#B72E35] dark:text-purple-400">Brighter Days.</span></span>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── UPCOMING EVENTS POPUP MODAL ─── */}
      {isEventsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="events-modal-title"
          className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsEventsModalOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-2xl bg-[#FAF4EB] dark:bg-[#1E1917] rounded-3xl border-2 border-[#E2D7C7] dark:border-stone-800 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Top Himalayan Accent Stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#B72E35] via-[#E88C38] to-[#B72E35] dark:from-purple-600 dark:via-fuchsia-500 dark:to-purple-600 shrink-0" />

            {/* Modal Header */}
            <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-[#E2D7C7] dark:border-stone-800/80 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B72E35]/10 dark:bg-purple-500/20 text-[#B72E35] dark:text-purple-300 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold">
                  <Sparkles className="w-3 h-3" />
                  Community Gatherings · Tapovan
                </div>
                <h3
                  id="events-modal-title"
                  className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-[#F3E7D3]"
                >
                  🎙️ Upcoming Events &amp; Sessions
                </h3>
                <p className="text-xs sm:text-sm text-[#725039] dark:text-stone-300 font-sans leading-relaxed">
                  Acoustic sundowners, spoken word circles, and slow coffee rituals in Tapovan. No tickets or table bookings required — walk in and belong.
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsEventsModalOpen(false)}
                className="p-1.5 sm:p-2 rounded-xl text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                aria-label="Close events popup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success / Error Feedback Banners */}
            {rsvpSuccessBanner && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5 shrink-0 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{rsvpSuccessBanner}</div>
                <button
                  type="button"
                  onClick={() => setRsvpSuccessBanner(null)}
                  className="text-emerald-700 dark:text-emerald-400 hover:opacity-70 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {rsvpErrorBanner && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 shrink-0 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{rsvpErrorBanner}</div>
                <button
                  type="button"
                  onClick={() => setRsvpErrorBanner(null)}
                  className="text-rose-700 dark:text-rose-400 hover:opacity-70 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Notice Strip */}
            <div className="px-4 sm:px-6 pt-3 pb-1 shrink-0">
              <div className="p-2.5 sm:p-3 rounded-xl bg-[#FAF0E1] dark:bg-stone-900/90 border border-[#CEBFAB]/70 dark:border-stone-800 text-[11px] sm:text-xs text-[#725039] dark:text-stone-300 flex items-center gap-2">
                <span className="text-base shrink-0">✨</span>
                <span>
                  <strong>Free Community Entry:</strong> All smol gatherings are free and open to everyone in Rishikesh. Reserving a spot below helps us keep cozy seating ready for you!
                </span>
              </div>
            </div>

            {/* Modal Body: Events List */}
            <div className="p-4 sm:p-6 space-y-3.5 overflow-y-auto flex-1">
              {[
                ...liveDbEvents.map((e) => ({
                  id: e.id,
                  title: e.title,
                  category: "Special Session",
                  timeLabel: new Date(e.startsAt).toLocaleDateString("en-IN", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                  }),
                  location: e.joinUrlOrNote || "The Living Library, Tapovan",
                  description: e.description,
                  capacity: e.capacity || 20,
                  rsvpCount: e.rsvpCount || 0,
                  badgeBg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
                })),
                ...CURATED_DEFAULT_EVENTS,
              ]
                .filter((evt, idx, arr) => arr.findIndex((x) => x.title === evt.title) === idx)
                .map((event) => {
                  const isConfirmed = !!confirmedRsvps[event.id];
                  const isRsvpingThis = activeRsvpEventId === event.id;

                  return (
                    <div
                      key={event.id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-[#E2D7C7] dark:border-stone-800 bg-white/70 dark:bg-stone-900/60 transition-all hover:border-[#B72E35]/40 dark:hover:border-purple-500/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-semibold border ${event.badgeBg}`}
                          >
                            {event.category}
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-mono text-[#725039] dark:text-stone-400">
                            • Free Entry
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B]">
                          <Clock className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
                          <span>{event.timeLabel}</span>
                        </div>
                      </div>

                      <h4 className="font-serif font-bold text-base sm:text-lg text-[#241F1C] dark:text-[#F3E7D3] mt-2">
                        {event.title}
                      </h4>

                      <div className="flex items-center gap-1.5 text-[11px] text-[#725039] dark:text-stone-400 mt-0.5 mb-2 font-mono">
                        <MapPin className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
                        <span>{event.location}</span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#725039] dark:text-stone-300 leading-relaxed font-sans">
                        {event.description}
                      </p>

                      {/* RSVP Interaction Area */}
                      <div className="mt-3 pt-3 border-t border-[#E2D7C7]/70 dark:border-stone-800/80">
                        {isConfirmed ? (
                          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-2.5 rounded-xl">
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>
                                Spot Reserved for {confirmedRsvps[event.id].name} ({confirmedRsvps[event.id].partySize}{" "}
                                {confirmedRsvps[event.id].partySize > 1 ? "guests" : "guest"})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCancelRsvp(event.id)}
                              className="text-[11px] text-[#725039] dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-2 cursor-pointer"
                            >
                              Cancel RSVP
                            </button>
                          </div>
                        ) : isRsvpingThis ? (
                          <div className="p-3 rounded-xl bg-[#FAF0E1] dark:bg-stone-900 border border-[#CEBFAB] dark:border-stone-700 space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#241F1C] dark:text-[#F3E7D3] flex items-center gap-1.5">
                                <Ticket className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
                                Reserve Your Free Spot
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveRsvpEventId(null)}
                                className="text-[11px] text-[#725039] dark:text-stone-400 hover:text-black dark:hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-mono uppercase text-[#725039] dark:text-stone-400 mb-1">
                                  Your Name *
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Maya Sharma"
                                  value={rsvpGuestName}
                                  onChange={(e) => setRsvpGuestName(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-stone-800 border border-[#CEBFAB] dark:border-stone-700 text-[#241F1C] dark:text-[#F3E7D3] focus:outline-none focus:border-[#B72E35] dark:focus:border-purple-500"
                                  autoFocus
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono uppercase text-[#725039] dark:text-stone-400 mb-1">
                                  WhatsApp / Phone (optional)
                                </label>
                                <input
                                  type="tel"
                                  placeholder="+91 98765 43210"
                                  value={rsvpGuestPhone}
                                  onChange={(e) => setRsvpGuestPhone(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-stone-800 border border-[#CEBFAB] dark:border-stone-700 text-[#241F1C] dark:text-[#F3E7D3] focus:outline-none focus:border-[#B72E35] dark:focus:border-purple-500"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#725039] dark:text-stone-400 font-mono">
                                  Guests:
                                </span>
                                <div className="inline-flex rounded-lg border border-[#CEBFAB] dark:border-stone-700 p-0.5 bg-white dark:bg-stone-800">
                                  <button
                                    type="button"
                                    onClick={() => setRsvpPartySize(1)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                      rsvpPartySize === 1
                                        ? "bg-[#B72E35] dark:bg-purple-600 text-white"
                                        : "text-[#725039] dark:text-stone-400 hover:text-black dark:hover:text-white"
                                    }`}
                                  >
                                    1 Person
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRsvpPartySize(2)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                      rsvpPartySize === 2
                                        ? "bg-[#B72E35] dark:bg-purple-600 text-white"
                                        : "text-[#725039] dark:text-stone-400 hover:text-black dark:hover:text-white"
                                    }`}
                                  >
                                    2 People
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isSubmittingRsvp}
                                onClick={() => handleRsvpSubmit(event.id, event.title)}
                                className="px-4 py-1.5 rounded-full bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ml-auto"
                              >
                                {isSubmittingRsvp ? (
                                  <span>Saving...</span>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3" />
                                    <span>Confirm My Spot</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] text-[#725039]/80 dark:text-stone-400 font-mono">
                              Limited seating · Walk-ins welcome
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRsvpEventId(event.id);
                                setRsvpSuccessBanner(null);
                                setRsvpErrorBanner(null);
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-[#FAF4EB] dark:bg-purple-950/40 hover:bg-[#B72E35] hover:text-white dark:hover:bg-purple-600 dark:hover:text-white text-[#B72E35] dark:text-purple-300 border border-[#B72E35]/40 dark:border-purple-500/40 font-mono text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Ticket className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
                              <span>Reserve Spot (Free)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 px-4 sm:px-6 bg-[#FAF0E1] dark:bg-stone-900 border-t border-[#E2D7C7] dark:border-stone-800 flex flex-col xs:flex-row items-center justify-between gap-2.5 text-center xs:text-left shrink-0">
              <a
                href={SMOL_CAFE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#725039] dark:text-stone-400 font-mono hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors flex items-center gap-1 group"
              >
                <span>📍 Upper Tapovan, Badrinath Road · Open Daily 7:30 AM – 11:00 PM</span>
                <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
              </a>
              <button
                type="button"
                onClick={() => setIsEventsModalOpen(false)}
                className="w-full xs:w-auto px-5 py-2 rounded-full bg-[#241F1C] dark:bg-stone-800 hover:bg-black text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── COMMUNITY FULLSCREEN LIGHTBOX MODAL ─── */}
      {currentLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] overflow-hidden bg-black/92 backdrop-blur-lg flex flex-col items-center justify-between p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveLightboxIndex(null);
            }
          }}
        >
          {/* Lightbox Top Header */}
          <div className="w-full max-w-5xl flex items-center justify-between text-white py-2 shrink-0 z-30">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-white/10 text-white font-mono text-xs border border-white/20">
                {(activeLightboxIndex ?? 0) + 1} / {filteredCommunityMedia.length}
              </span>
              <span className="text-xs sm:text-sm font-mono text-stone-300 uppercase tracking-wider hidden sm:inline">
                {currentLightboxItem.type === "video" ? "🎥 Live Video Reel" : "📸 Community Photo"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveLightboxIndex(null)}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Center Content & Nav */}
          <div className="relative w-full max-w-5xl flex-1 flex items-center justify-center min-h-0 my-auto py-2">
            {/* Prev Button (Desktop / Tablet) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveLightboxIndex((prev) =>
                  prev !== null && prev > 0 ? prev - 1 : filteredCommunityMedia.length - 1
                );
              }}
              className="hidden sm:flex absolute left-0 lg:-left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-[#B72E35] dark:hover:bg-purple-600 text-white border border-white/20 transition-all cursor-pointer z-30 shadow-lg"
              aria-label="Previous moment"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Media Display */}
            <div className="relative max-h-full max-w-full flex items-center justify-center animate-in zoom-in-95 duration-200">
              {currentLightboxItem.type === "video" ? (
                <video
                  src={currentLightboxItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[72vh] sm:max-h-[78vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain bg-black border border-white/10"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentLightboxItem.url}
                  alt={currentLightboxItem.alt}
                  className="max-h-[72vh] sm:max-h-[78vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
                />
              )}
            </div>

            {/* Next Button (Desktop / Tablet) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveLightboxIndex((prev) =>
                  prev !== null && prev < filteredCommunityMedia.length - 1 ? prev + 1 : 0
                );
              }}
              className="hidden sm:flex absolute right-0 lg:-right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-[#B72E35] dark:hover:bg-purple-600 text-white border border-white/20 transition-all cursor-pointer z-30 shadow-lg"
              aria-label="Next moment"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Bottom Caption & Mobile Navigation */}
          <div className="w-full max-w-2xl text-center space-y-2 py-2 shrink-0 z-20">
            <p className="font-serif italic text-white text-sm sm:text-base leading-snug">
              “{currentLightboxItem.caption}”
            </p>

            {/* Mobile Navigation controls */}
            <div className="sm:hidden flex items-center justify-center gap-4 pt-1">
              <button
                type="button"
                onClick={() =>
                  setActiveLightboxIndex((prev) =>
                    prev !== null && prev > 0 ? prev - 1 : filteredCommunityMedia.length - 1
                  )
                }
                className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-[#B72E35] dark:hover:bg-purple-600 text-white text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveLightboxIndex((prev) =>
                    prev !== null && prev < filteredCommunityMedia.length - 1 ? prev + 1 : 0
                  )
                }
                className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-[#B72E35] dark:hover:bg-purple-600 text-white text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

