"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export const BottomNavBar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = React.useMemo(() => {
    if (pathname === "/home" || pathname === "/") return 0;
    if (pathname.startsWith("/drinks")) return 2;
    if (pathname.startsWith("/smol-menu") || pathname.startsWith("/menu")) return 1;
    if (pathname.startsWith("/orders") || pathname.startsWith("/order-status")) return 3;
    if (pathname.startsWith("/profile") || pathname.startsWith("/account")) return 4;
    return 0;
  }, [pathname]);

  // Aggressive route prefetching on mount for instant customer navigation
  React.useEffect(() => {
    const routes = ["/home", "/smol-menu", "/drinks", "/orders", "/profile", "/bill"];
    routes.forEach((r) => {
      try {
        router.prefetch(r);
      } catch {
        // safe
      }
    });
  }, [router]);

  const navItems = [
    {
      label: "Home",
      href: "/home",
      icon: (
        <svg className="h-[21px] w-[21px] shrink-0" viewBox="0 0 24 24">
          <mask id="nav-dining-home-mask">
            <rect width="24" height="24" fill="white" />
            <path
              d="M5.4 11.2v3.0a1.1 1.1 0 0 0 1.1 1.1v4.8a.75.75 0 0 0 1.5 0v-4.8a1.1 1.1 0 0 0 1.1-1.1v-3.0"
              stroke="black"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <line x1="6.5" y1="11.2" x2="6.5" y2="14.2" stroke="black" strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="12.0" cy="15.5" r="3.7" stroke="black" strokeWidth="1.2" fill="none" />
            <circle cx="12.0" cy="15.5" r="2.2" stroke="black" strokeWidth="1.2" fill="none" />
            <path
              d="M18.2 11.2c-1.5 0-2.1 1.4-2.1 4.2h2.1v-4.2z"
              stroke="black"
              strokeWidth="1.1"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M17.1 15.6v4.5a.75.75 0 0 0 1.5 0v-4.5"
              stroke="black"
              strokeWidth="1.1"
              strokeLinecap="round"
              fill="none"
            />
          </mask>
          <rect x="5.4" y="4.5" width="2.4" height="4.5" rx="0.4" fill="currentColor" />
          <path
            d="M12 3.5L2.2 10.8h1.8v9.4a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8v-9.4h1.8L12 3.5z"
            fill="currentColor"
            mask="url(#nav-dining-home-mask)"
          />
        </svg>
      ),
    },
    {
      label: "Menu",
      href: "/smol-menu",
      icon: (
        <svg className="h-[21px] w-[21px] shrink-0" viewBox="0 0 24 24">
          <mask id="nav-restaurant-menu-mask">
            <rect width="24" height="24" fill="white" />
            <line x1="14.2" y1="8.2" x2="18.8" y2="8.2" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="14.2" y1="10.7" x2="18.8" y2="10.7" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="14.2" y1="13.2" x2="18.8" y2="13.2" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="14.2" y1="15.7" x2="18.8" y2="15.7" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
            <path
              d="M6.6 11.5c-.7 0-1.3-.6-1.3-1.3 0-.7.5-1.3 1.2-1.4.1-.9.9-1.6 1.8-1.6.9 0 1.7.7 1.8 1.6.7.1 1.2.7 1.2 1.4 0 .7-.6 1.3-1.3 1.3"
              fill="none"
              stroke="black"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path d="M6.8 11.8h4.4v1.3H6.8z" fill="none" stroke="black" strokeWidth="1.1" strokeLinejoin="round" />
            <circle cx="9.0" cy="12.45" r="0.5" fill="black" />
            <line x1="6.0" y1="14.8" x2="12.0" y2="14.8" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="7.0" y1="16.8" x2="11.0" y2="16.8" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="7.4" y1="18.8" x2="10.6" y2="18.8" stroke="black" strokeWidth="1.2" strokeLinecap="round" />
          </mask>
          <path
            d="M8.2 6.8 L 12.2 4.2 L 16.0 5.8 L 12.2 7.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="12.2" y="5.0" width="8.8" height="14.8" rx="1.5" fill="currentColor" mask="url(#nav-restaurant-menu-mask)" />
          <rect x="4.0" y="6.8" width="10.0" height="14.4" rx="1.5" fill="currentColor" mask="url(#nav-restaurant-menu-mask)" />
        </svg>
      ),
    },
    {
      label: "Drinks",
      href: "/drinks",
      icon: (
        <svg className="h-[21px] w-[21px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {/* Steam waves */}
          <path d="M7.5 2.5v2.5M11 2v3M14.5 2.5v2.5" strokeWidth="1.6" />
          {/* Coffee cup */}
          <path d="M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" strokeWidth="1.8" fill="currentColor" fillOpacity="0.15" />
          {/* Handle */}
          <path d="M16 9h2.5a2 2 0 0 1 2 2v1.5a2 2 0 0 1-2 2H16" strokeWidth="1.8" />
          {/* Saucer */}
          <line x1="3" y1="21" x2="21" y2="21" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Orders",
      href: "/orders",
      icon: (
        <svg className="h-[21px] w-[21px] shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5a1.75 1.75 0 0 1 1.75 1.75c0 .44-.16.84-.43 1.15.44.33.73.85.73 1.44v.36a9.5 9.5 0 0 0-4.1 0v-.36c0-.59.29-1.11.73-1.44A1.74 1.74 0 0 1 10.25 4.25 1.75 1.75 0 0 1 12 2.5Z" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 7.75c-4.83 0-8.75 3.92-8.75 8.75h17.5c0-4.83-3.92-8.75-8.75-8.75Zm2.2 1.85c.42-.38 1.07-.3 1.42.15 1.25 1.48 1.9 3.02 1.98 4.2.04.55-.4.98-.95.92-.5-.06-.85-.52-.9-1.02-.07-.9-.58-2.15-1.65-3.32-.38-.42-.32-1.05.1-1.43Z"
          />
          <path d="M2.5 18h19c.69 0 1.25.56 1.25 1.25s-.56 1.25-1.25 1.25h-19c-.69 0-1.25-.56-1.25-1.25S1.81 18 2.5 18Z" />
        </svg>
      ),
    },
    {
      label: "Table",
      href: "/profile",
      icon: (
        <svg className="h-[21px] w-[21px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5.2" r="3.2" strokeWidth="1.7" />
          <path d="M4.6 15.8C4.6 11.6 7.8 9.8 12 9.8s7.4 1.8 7.4 6.0" strokeWidth="1.7" />
          <path d="M7.4 15.8v2.4M16.6 15.8v2.4" strokeWidth="1.7" />
          <rect x="1.8" y="15.8" width="5.2" height="3.2" rx="1.6" strokeWidth="1.7" />
          <rect x="17.0" y="15.8" width="5.2" height="3.2" rx="1.6" strokeWidth="1.7" />
          <path d="M4.4 15.8V12.8M3.0 9.8v2.0a1.4 1.4 0 0 0 2.8 0V9.8M4.4 9.8v2.8" strokeWidth="1.6" />
          <path d="M19.6 15.8v-3.2c0-1.8-.8-2.8-1.8-2.8v6.0" strokeWidth="1.6" />
          <ellipse cx="12" cy="20.0" rx="5.4" ry="2.0" strokeWidth="1.8" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-3 left-0 right-0 z-50 px-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] pointer-events-none select-none"
    >
      <div className="relative pointer-events-auto mx-auto w-full max-w-[420px]">
        {/* Ambient Backlight Glass Diffusion */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-600/10 via-[#B72E35]/15 to-amber-500/10 dark:from-purple-600/20 dark:via-purple-800/30 dark:to-purple-600/20 blur-xl -z-10 opacity-80" />

        {/* Floating Ultra-Frosted Glassmorphic Container */}
        <div
          className="relative h-[64px] rounded-2xl sm:rounded-3xl px-2 py-1 flex items-center justify-between
            bg-white/70 dark:bg-[#1C1613]/80
            backdrop-blur-[28px] backdrop-saturate-[200%]
            border border-white/80 dark:border-white/15
            shadow-[0_12px_40px_rgba(74,46,27,0.12),0_4px_12px_rgba(0,0,0,0.04),inset_0_1.5px_1.5px_rgba(255,255,255,0.9),inset_0_-1px_1.5px_rgba(0,0,0,0.05)]
            dark:shadow-[0_18px_48px_rgba(0,0,0,0.7),inset_0_1.5px_1px_rgba(255,255,255,0.16),inset_0_-1px_1px_rgba(0,0,0,0.5)]
            transition-all duration-300"
        >
          {/* Smooth Sliding Active Pill Indicator & Bottom Accent Bar */}
          <div
            className="absolute top-1 bottom-1 left-2 w-[calc((100%-1rem)/5)] rounded-xl bg-[#B72E35]/10 dark:bg-purple-600/25 border border-[#B72E35]/15 dark:border-purple-500/35 shadow-[0_2px_8px_rgba(183,46,53,0.08)] dark:shadow-[0_2px_12px_rgba(168,85,247,0.25)] pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          >
            {/* Sliding Bottom Thin Accent Line */}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full bg-[#B72E35] dark:bg-purple-400 shadow-[0_1px_3px_rgba(183,46,53,0.35)] dark:shadow-[0_1px_6px_rgba(192,132,252,0.7)] transition-colors" />
          </div>

          {navItems.map((item, index) => {
            const active = activeIndex === index;

            return (
              <Link
                key={item.label}
                href={item.href}
                prefetch={true}
                aria-label={item.label}
                onMouseEnter={() => {
                  try {
                    router.prefetch(item.href);
                  } catch {}
                }}
                onTouchStart={() => {
                  try {
                    router.prefetch(item.href);
                  } catch {}
                }}
                className="group relative z-10 flex flex-1 flex-col items-center justify-center h-full rounded-xl transition-all duration-200 active:scale-95 touch-manipulation focus:outline-none cursor-pointer py-1"
              >
                <div
                  className={`flex items-center justify-center transition-all duration-300 ease-out ${
                    active
                      ? "scale-110 -translate-y-0.5 text-[#B72E35] dark:text-purple-400"
                      : "text-[#725039] dark:text-[#C9AE8B] group-hover:scale-105 group-hover:text-[#241F1C] dark:group-hover:text-[#FAF4EB]"
                  }`}
                >
                  {item.icon}
                </div>

                <span
                  className={`text-[10px] sm:text-[11px] font-sans tracking-tight mt-1 leading-none transition-all duration-200 ${
                    active
                      ? "font-extrabold text-[#B72E35] dark:text-purple-300"
                      : "font-semibold text-[#725039] dark:text-[#C9AE8B] group-hover:text-[#241F1C] dark:group-hover:text-[#FAF4EB]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
