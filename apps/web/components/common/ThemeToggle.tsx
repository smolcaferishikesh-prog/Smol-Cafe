"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { resolveEffectiveTheme, applyThemeToDOM, isISTNightTime } from "@/lib/theme-utils";

interface ThemeToggleProps {
  variant?: "pill" | "icon" | "minimal";
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = "pill",
  className = "",
}) => {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const effective = resolveEffectiveTheme();
    setIsDark(effective);
    applyThemeToDOM(effective);

    // Periodic check every 60 seconds to auto-transition at 6:00 PM and 4:00 AM IST
    const interval = setInterval(() => {
      const saved = localStorage.getItem("smol_theme");
      // If user hasn't explicitly set manual permanent override, follow IST auto
      if (!saved || saved === "auto") {
        const istDark = isISTNightTime();
        setIsDark(istDark);
        applyThemeToDOM(istDark);
      }
    }, 60000);

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setIsDark(customEvent.detail);
      }
    };

    window.addEventListener("smol_theme_changed", handleCustomChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("smol_theme_changed", handleCustomChange);
    };
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    applyThemeToDOM(next);
    localStorage.setItem("smol_theme", next ? "night" : "day");
    window.dispatchEvent(new CustomEvent("smol_theme_changed", { detail: next }));
  };

  if (!mounted) {
    return (
      <div
        className={`h-8 w-16 rounded-full border border-stone-700/50 bg-stone-800/40 opacity-0 ${className}`}
      />
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer ${
          isDark
            ? "border-stone-700 bg-[#241F1C] text-[#F2C84B] hover:text-white hover:border-stone-600"
            : "border-[#C9AE8B]/50 bg-[#FAF4EB] text-[#B72E35] hover:text-[#241F1C] hover:border-[#B72E35]/40"
        } ${className}`}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center justify-center gap-1.5 rounded-full border h-7 sm:h-auto px-2 sm:px-3 py-1 font-mono text-xs transition cursor-pointer select-none shadow-xs active:scale-95 shrink-0 ${
        isDark
          ? "border-stone-700 bg-[#241F1C] text-[#F2C84B] hover:bg-stone-800/80 hover:text-white"
          : "border-[#C9AE8B]/50 bg-[#FAF4EB] text-[#725039] hover:bg-[#F3E7D3] hover:text-[#241F1C]"
      } ${className}`}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <>
          <Sun className="h-3.5 w-3.5 text-[#F2C84B] shrink-0" />
          <span className="font-semibold hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5 text-[#B72E35] shrink-0" />
          <span className="font-semibold hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
};
