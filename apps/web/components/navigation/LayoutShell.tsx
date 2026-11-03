"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { InstallAppPrompt } from "@/components/common/InstallAppPrompt";
import { OfflineSyncBanner } from "@/components/common/OfflineSyncBanner";
import { BottomNavBar } from "@/components/navigation/BottomNavBar";
import { AppSplashScreen } from "@/components/common/AppSplashScreen";
import { CartProvider } from "@/context/CartContext";

interface LayoutShellProps {
  children: React.ReactNode;
  initialHasTableSession?: boolean;
}

/**
 * Wraps children and conditionally renders the RoleSwitcherBar and BottomNavBar.
 * Persistent across client navigations so BottomNavBar never flickers or disappears.
 * Ensures the bottom navbar is strictly visible ONLY for active table customers and hidden on all 404/error pages.
 */
export const LayoutShell: React.FC<LayoutShellProps> = ({
  children,
  initialHasTableSession = false,
}) => {
  const pathname = usePathname();
  const [hasTableSession, setHasTableSession] = React.useState(initialHasTableSession);
  const [isErrorOr404, setIsErrorOr404] = React.useState(false);

  React.useEffect(() => {
    const updateSessionState = () => {
      if (typeof document !== "undefined") {
        const hasCookie = document.cookie.includes("smol_table_active=1");
        const isTableRoute =
          Boolean(pathname?.startsWith("/t/")) ||
          Boolean(pathname?.startsWith("/smol-cafe/table-")) ||
          Boolean(pathname?.includes("/table-"));

        setHasTableSession(hasCookie || isTableRoute || initialHasTableSession);

        const isMarkedHide =
          document.body.dataset.hideNavbar === "true" ||
          document.body.dataset.is404 === "true" ||
          document.querySelector("[data-hide-navbar='true']") !== null ||
          pathname === "/404" ||
          pathname?.startsWith("/404");

        setIsErrorOr404(Boolean(isMarkedHide));
      }
    };

    updateSessionState();

    const observer = new MutationObserver(() => {
      updateSessionState();
    });

    if (typeof document !== "undefined") {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-hide-navbar", "data-is404"],
        childList: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [pathname, initialHasTableSession]);

  const isCustomerFacingRoute =
    pathname === "/" ||
    pathname === "/home" ||
    pathname?.startsWith("/home") ||
    pathname?.startsWith("/t/") ||
    pathname === "/t" ||
    pathname?.startsWith("/smol-menu") ||
    pathname?.startsWith("/menu") ||
    pathname?.startsWith("/orders") ||
    pathname?.startsWith("/bill") ||
    pathname?.startsWith("/cart") ||
    pathname === "/table" ||
    pathname?.startsWith("/table") ||
    pathname?.startsWith("/profile") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/events") ||
    pathname?.startsWith("/music") ||
    pathname?.startsWith("/drinks");

  const isCustomerNavRoute =
    pathname === "/home" ||
    pathname?.startsWith("/home") ||
    pathname?.startsWith("/smol-menu") ||
    pathname?.startsWith("/menu") ||
    pathname?.startsWith("/drinks") ||
    pathname?.startsWith("/orders") ||
    pathname?.startsWith("/order-status") ||
    pathname?.startsWith("/profile") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/events") ||
    pathname?.startsWith("/music");

  // Bottom navbar ONLY shows if user has an active table session AND is on a customer route AND not on 404/error
  const showBottomNavBar =
    !isErrorOr404 &&
    pathname !== "/404" &&
    hasTableSession &&
    isCustomerNavRoute;

  // Real-time synchronization of mobile status bar color (<meta name="theme-color">)
  React.useEffect(() => {
    const updateMetaThemeColor = () => {
      const isDark = document.documentElement.classList.contains("dark");
      const targetColor = isDark ? "#151110" : "#F3E7D3";

      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", targetColor);
    };

    updateMetaThemeColor();

    const observer = new MutationObserver(() => {
      updateMetaThemeColor();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    window.addEventListener("smol_theme_changed", updateMetaThemeColor);

    return () => {
      observer.disconnect();
      window.removeEventListener("smol_theme_changed", updateMetaThemeColor);
    };
  }, []);

  return (
    <CartProvider>
      <AppSplashScreen />
      {/* Offline sync banner disabled as requested */}
      {/* <OfflineSyncBanner /> */}
      {children}
      {showBottomNavBar && <BottomNavBar />}
      <InstallAppPrompt />
    </CartProvider>
  );
};
