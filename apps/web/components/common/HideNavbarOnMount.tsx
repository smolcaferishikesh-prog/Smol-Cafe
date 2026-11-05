"use client";

import { useEffect } from "react";

export function HideNavbarOnMount() {
  useEffect(() => {
    document.body.setAttribute("data-hide-navbar", "true");
    document.body.setAttribute("data-is404", "true");

    return () => {
      document.body.removeAttribute("data-hide-navbar");
      document.body.removeAttribute("data-is404");
    };
  }, []);

  return null;
}

