"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { RoleSwitcherBar } from "@/components/navigation/RoleSwitcherBar";
import { InstallAppPrompt } from "@/components/common/InstallAppPrompt";
import { OfflineSyncBanner } from "@/components/common/OfflineSyncBanner";
import { BottomNavBar } from "@/components/navigation/BottomNavBar";
import { AppSplashScreen } from "@/components/common/AppSplashScreen";

interface LayoutShellProps {
  children: React.ReactNode;
}

/**
 * Wraps children and conditionally renders the RoleSwitcherBar and BottomNavBar.
 * Persistent across client navigations so BottomNavBar never flickers or disappears.
 */
export const LayoutShell: React.FC<LayoutShellProps> = ({ children }) => {
  const pathname = usePathname();

  // The RoleSwitcherBar is an internal staff development/operations bar.
  // It must NEVER be shown to customers (not on landing "/", not on table routes "/t/...",
  // nor on customer menu, cart, orders, or bill).
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

  const isStaffWorkspace =
    pathname?.startsWith("/kitchen") ||
    pathname?.startsWith("/barista") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/cashier");

  const showRoleSwitcher = !isCustomerFacingRoute && isStaffWorkspace;

  const showBottomNavBar =
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
    <>
      <AppSplashScreen />
      <OfflineSyncBanner />
      {showRoleSwitcher && <RoleSwitcherBar />}
      {children}
      {showBottomNavBar && <BottomNavBar />}
      <InstallAppPrompt />
    </>
  );
};
