import { NextRequest, NextResponse } from "next/server";

const STAFF_SESSION_COOKIE = "smol_staff_session";
const STAFF_ROLE_COOKIE_PREFIX = "smol_staff_role_";
const TABLE_SESSION_COOKIE = "smol_table_session";
const STAFF_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

const ALL_ROLES = ["admin", "cashier", "barista", "kitchen"] as const;

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

/**
 * Extracts all active (< 12h) staff roles from the request cookies (`smol_staff_session`
 * and `smol_staff_role_<role>`) so multiple roles open simultaneously in the same browser
 * all stay authorized without logging each other out.
 */
function getActiveStaffRoles(request: NextRequest): string[] {
  const activeRoles: string[] = [];
  const seen = new Set<string>();

  const checkSegment = (seg?: string) => {
    if (!seg) return;
    const parts = seg.split(":");
    const rawRole = parts[0]?.trim().toLowerCase();
    if (!rawRole || !ROLE_ROUTES[rawRole]) return;

    const rawIssuedAt = parts[2] ? Number(parts[2]) : NaN;
    if (Number.isFinite(rawIssuedAt) && rawIssuedAt > 0) {
      if (Date.now() - rawIssuedAt > STAFF_SESSION_DURATION_MS) {
        return; // Expired after 12 hours
      }
    }

    if (!seen.has(rawRole)) {
      seen.add(rawRole);
      activeRoles.push(rawRole);
    }
  };

  const combinedRaw = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (combinedRaw) {
    for (const seg of combinedRaw.split("|")) {
      checkSegment(seg);
    }
  }

  for (const r of ALL_ROLES) {
    const roleCookie = request.cookies.get(`${STAFF_ROLE_COOKIE_PREFIX}${r}`)?.value;
    if (roleCookie) {
      checkSegment(roleCookie);
    }
  }

  return activeRoles;
}

function hasRoutePermission(activeRoles: string[], targetPrefix: string): boolean {
  return activeRoles.some((role) => {
    const allowed = ROLE_ROUTES[role] ?? [];
    return allowed.some((route) => targetPrefix.startsWith(route));
  });
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
  const activeRoles = getActiveStaffRoles(request);
  const hasAnyActiveStaff = activeRoles.length > 0;

  // 2. Direct hit on /admin, /barista, /kitchen, /cashier
  const isDirectStaffRoute = DIRECT_STAFF_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isDirectStaffRoute) {
    if (hasAnyActiveStaff) {
      const hasAdminRole = activeRoles.some(
        (r) => r === "admin" || r === "super_admin" || r === "authenticated"
      );

      // Allow admin sub-pages (/admin/tables, /admin/rewards, etc.) when admin session is active
      if (pathname.startsWith("/admin/") && hasAdminRole) {
        return NextResponse.next();
      }

      if (pathname === "/admin" && hasAdminRole) {
        return NextResponse.redirect(new URL("/smol-backdoor/admin", request.url));
      }
      if (
        (pathname === "/cashier" || pathname.startsWith("/cashier/")) &&
        hasRoutePermission(activeRoles, "/cashier")
      ) {
        return NextResponse.redirect(new URL("/smol-backdoor/cashier", request.url));
      }
      if (
        (pathname === "/barista" || pathname.startsWith("/barista/")) &&
        hasRoutePermission(activeRoles, "/barista")
      ) {
        return NextResponse.redirect(new URL("/smol-backdoor/barista", request.url));
      }
      if (
        (pathname === "/kitchen" || pathname.startsWith("/kitchen/")) &&
        hasRoutePermission(activeRoles, "/kitchen")
      ) {
        return NextResponse.redirect(new URL("/smol-backdoor/kitchen", request.url));
      }

      const primaryRole = activeRoles[0];
      const homePortal = ROLE_HOME_PORTAL[primaryRole] || "/smol-backdoor";
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

  // 5. Verify at least one active 12-hour staff session cookie
  if (!hasAnyActiveStaff) {
    const backdoorUrl = new URL("/smol-backdoor", request.url);
    return NextResponse.redirect(backdoorUrl);
  }

  // 6. Check if ANY of the concurrently active roles has permission for this route
  const hasAccess = hasRoutePermission(activeRoles, pathname);

  if (!hasAccess) {
    // Redirect to /smol-backdoor?switch=1 so the user can unlock this additional role without losing existing roles
    const backdoorUrl = new URL("/smol-backdoor?switch=1", request.url);
    return NextResponse.redirect(backdoorUrl);
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
