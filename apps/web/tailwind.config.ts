import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "EB Garamond", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Noto Sans Mono", "monospace"],
        chalk: ["var(--font-chalk)", "Caveat", "cursive"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        smol: {
          creme: "#F3E7D3",      // Café Crème (Core Neutral Canvas)
          cherry: "#B72E35",     // Smol Cherry (Iconic Hero Colour)
          butter: "#F2C84B",     // Butter Taxi (Daylight Spark / Night Utility)
          espresso: "#241F1C",   // Espresso Ink (Night Canvas / Deep Text)
          biscuit: "#C9AE8B",    // Biscuit (Warm Secondary Neutral)
          violet: "#754CFF",     // Electric Violet (5-12% Night / Music Accent)
          pool: "#75AFA7",       // Dusty Pool (Botanical Surprise Accent)
          walnut: "#725039",     // Walnut (Secondary Copy / Earth)
        },
        cafe: {
          bg: "#F3E7D3",
          card: "#FAF4EB",
          border: "#E2D7C7",
          crimson: "#B72E35",
          darkCrimson: "#9E242B",
          text: "#241F1C",
          subtext: "#725039",
          peach: "#FDF0E7",
          peachBorder: "#F3D8C7",
          peachText: "#8C3A27",
          seafoam: "#E6F1EE",
          seafoamBorder: "#C0DBD7",
          seafoamText: "#2C5852",
          ochre: "#FDF6E2",
          ochreBorder: "#F2C84B",
          ochreText: "#725039",
          sage: "#EDF4EF",
          sageBorder: "#C2DDC7",
          sageText: "#2E5536",
          blackboard: "#241F1C",
        },
      },
    },
  },
  plugins: [],
};

export default config;

