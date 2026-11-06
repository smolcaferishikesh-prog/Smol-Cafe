import { NextRequest, NextResponse } from "next/server";

const STAFF_SESSION_COOKIE = "smol_staff_session";
const TABLE_SESSION_COOKIE = "smol_table_session";
const STAFF_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Customer routes that require an active table QR session
const TABLE_PROTECTED_ROUTES = [
  "/home",
  "/menu",
  "/drinks",
  "/order",
  "/orders",
  "/profile",
  "/smol-menu",
  "/bill",
  "/order-status",
];

// Role → allowed routes mapping (matching requireStaffAuth across pages)
const ROLE_ROUTES: Record<string, string[]> = {
  kitchen: [
    "/smol-backdoor/kitchen",
    "/smol-backdoor/barista",
    "/kitchen",
    "/cashier",
  ],
  chef: [
    "/smol-backdoor/kitchen",
    "/smol-backdoor/barista",
    "/kitchen",
    "/cashier",
  ],
  barista: [
    "/smol-backdoor/barista",
    "/barista",
    "/cashier",
  ],
  cashier: [
    "/smol-backdoor/cashier",
    "/cashier",
  ],
  admin: [
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
    "/admin",
    "/kitchen",
    "/cashier",
    "/barista",
  ],
  super_admin: [
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
    "/admin",
    "/kitchen",
    "/cashier",
    "/barista",
  ],
  authenticated: [
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
    "/admin",
    "/kitchen",
    "/cashier",
    "/barista",
  ],
};

const ROLE_HOME_PORTAL: Record<string, string> = {
  kitchen: "/smol-backdoor/kitchen",
  chef: "/smol-backdoor/kitchen",
  barista: "/smol-backdoor/barista",
  cashier: "/smol-backdoor/cashier",
  admin: "/smol-backdoor/admin",
  super_admin: "/smol-backdoor/admin",
  authenticated: "/smol-backdoor/admin",
};

// Protected backdoor routes that require authentication
const PROTECTED_PREFIXES = [
  "/smol-backdoor/kitchen",
  "/smol-backdoor/cashier",
  "/smol-backdoor/admin",
  "/smol-backdoor/barista",
];

// Direct naked staff paths
const DIRECT_STAFF_ROUTES = [
  "/admin",
  "/barista",
  "/kitchen",
  "/cashier",
];

function getActiveStaffSession(request: NextRequest): {
  role: string;
  rawCookie: string;
  remainingSeconds: number;
} | null {
  const rawCookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (!rawCookie) return null;

  const parts = rawCookie.split(":");
  const role = parts[0]?.trim().toLowerCase();
  if (!role || !ROLE_ROUTES[role]) return null;

  const rawIssuedAt = parts[2] ? Number(parts[2]) : NaN;
  if (Number.isFinite(rawIssuedAt) && rawIssuedAt > 0) {
    const elapsedMs = Date.now() - rawIssuedAt;
    if (elapsedMs > STAFF_SESSION_DURATION_MS) {
      return null; // Expired after 12 hours
    }
    const remainingSeconds = Math.max(
      1,
      Math.floor((STAFF_SESSION_DURATION_MS - elapsedMs) / 1000)
    );
    return { role, rawCookie, remainingSeconds };
  }

  // Legacy cookie without timestamp: valid for 12 hours
  return { role, rawCookie, remainingSeconds: 60 * 60 * 12 };
}

export function middleware(request: NextRequest) {
  // 1. Bypass Server Actions and API mutation POST requests
  if (
    request.method === "POST" ||
    request.headers.get("next-action") ||
    request.headers.get("x-next-action")
  ) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const activeStaff = getActiveStaffSession(request);

  // 2. Direct hit on /admin, /barista, /kitchen, /cashier
  const isDirectStaffRoute = DIRECT_STAFF_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isDirectStaffRoute) {
    if (activeStaff) {
      // Allow admin sub-pages (/admin/tables, /admin/rewards, etc.) when logged in as admin
      if (
        pathname.startsWith("/admin/") &&
        (activeStaff.role === "admin" ||
          activeStaff.role === "super_admin" ||
          activeStaff.role === "authenticated")
      ) {
        return NextResponse.next();
      }

      // Redirect exact naked routes (/admin, /cashier, /barista, /kitchen) to their active backdoor dashboard
      if (
        pathname === "/admin" &&
        (activeStaff.role === "admin" ||
          activeStaff.role === "super_admin" ||
          activeStaff.role === "authenticated")
      ) {
        return NextResponse.redirect(new URL("/smol-backdoor/admin", request.url));
      }
      if (pathname === "/cashier" || pathname.startsWith("/cashier/")) {
        const allowed = ROLE_ROUTES[activeStaff.role] ?? [];
        if (allowed.includes("/cashier")) {
          return NextResponse.redirect(new URL("/smol-backdoor/cashier", request.url));
        }
      }
      if (pathname === "/barista" || pathname.startsWith("/barista/")) {
        const allowed = ROLE_ROUTES[activeStaff.role] ?? [];
        if (allowed.includes("/barista")) {
          return NextResponse.redirect(new URL("/smol-backdoor/barista", request.url));
        }
      }
      if (pathname === "/kitchen" || pathname.startsWith("/kitchen/")) {
        const allowed = ROLE_ROUTES[activeStaff.role] ?? [];
        if (allowed.includes("/kitchen")) {
          return NextResponse.redirect(new URL("/smol-backdoor/kitchen", request.url));
        }
      }

      // Otherwise redirect to the logged-in staff member's own station portal
      const homePortal = ROLE_HOME_PORTAL[activeStaff.role] || "/smol-backdoor";
      return NextResponse.redirect(new URL(homePortal, request.url));
    }

    const backdoorUrl = new URL("/smol-backdoor", request.url);
    return NextResponse.redirect(backdoorUrl);
  }

  // 3. Customer table-protected routes: must have active table QR session
  const isTableProtectedRoute = TABLE_PROTECTED_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isTableProtectedRoute) {
    const hasTableQueryParam =
      request.nextUrl.searchParams.has("table") ||
      request.nextUrl.searchParams.has("t");
    const rawTableCookie = request.cookies.get(TABLE_SESSION_COOKIE)?.value;

    // If no QR table param in URL AND no valid table session cookie -> 404 Table Not Found
    if (!hasTableQueryParam && (!rawTableCookie || !rawTableCookie.includes("."))) {
      const notFoundUrl = new URL("/404", request.url);
      return NextResponse.redirect(notFoundUrl);
    }
  }

  // 4. Check if this is a protected backdoor staff route
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    const rawTableCookie = request.cookies.get(TABLE_SESSION_COOKIE)?.value;
    const response = NextResponse.next();
    if (rawTableCookie && rawTableCookie.includes(".")) {
      if (!request.cookies.has("smol_table_active")) {
        response.cookies.set("smol_table_active", "1", {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 60 * 60 * 12,
        });
      }
    } else if (request.cookies.has("smol_table_active")) {
      response.cookies.delete("smol_table_active");
    }
    return response;
  }

  // 5. Verify active 12-hour staff session cookie
  if (!activeStaff) {
    const backdoorUrl = new URL("/smol-backdoor", request.url);
    return NextResponse.redirect(backdoorUrl);
  }

  // 6. Check role has permission for this route
  const allowedRoutes = ROLE_ROUTES[activeStaff.role] ?? [];
  const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route));

  if (!hasAccess) {
    const homePortal = ROLE_HOME_PORTAL[activeStaff.role] || "/smol-backdoor";
    return NextResponse.redirect(new URL(homePortal, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/kitchen",
    "/kitchen/:path*",
    "/cashier",
    "/cashier/:path*",
    "/admin",
    "/admin/:path*",
    "/barista",
    "/barista/:path*",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/kitchen/:path*",
    "/smol-backdoor/cashier",
    "/smol-backdoor/cashier/:path*",
    "/smol-backdoor/admin",
    "/smol-backdoor/admin/:path*",
    "/smol-backdoor/barista",
    "/smol-backdoor/barista/:path*",
    "/home",
    "/home/:path*",
    "/menu",
    "/menu/:path*",
    "/drinks",
    "/drinks/:path*",
    "/order",
    "/order/:path*",
    "/orders",
    "/orders/:path*",
    "/profile",
    "/profile/:path*",
    "/smol-menu",
    "/smol-menu/:path*",
    "/bill",
    "/bill/:path*",
    "/order-status",
    "/order-status/:path*",
  ],
};
