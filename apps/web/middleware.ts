import { NextRequest, NextResponse } from "next/server";

const STAFF_SESSION_COOKIE = "smol_staff_session";

// Role → allowed routes mapping (only valid backdoor routes)
const ROLE_ROUTES: Record<string, string[]> = {
  kitchen: ["/smol-backdoor/kitchen"],
  barista: ["/smol-backdoor/barista"],
  cashier: ["/smol-backdoor/cashier"],
  admin: [
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
  ],
  super_admin: [
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
  ],
  authenticated: [
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
  ],
};

// Protected backdoor routes that require authentication
const PROTECTED_PREFIXES = [
  "/smol-backdoor/kitchen",
  "/smol-backdoor/cashier",
  "/smol-backdoor/admin",
  "/smol-backdoor/barista",
];

// Direct naked staff paths that must redirect to /smol-backdoor
const DIRECT_STAFF_ROUTES = [
  "/admin",
  "/barista",
  "/kitchen",
  "/cashier",
];

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

  // 2. Direct hit on /admin, /barista, /kitchen, /cashier -> Redirect to /smol-backdoor
  const isDirectStaffRoute = DIRECT_STAFF_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isDirectStaffRoute) {
    const backdoorUrl = new URL("/smol-backdoor", request.url);
    return NextResponse.redirect(backdoorUrl);
  }

  // 3. Check if this is a protected backdoor staff route
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // 4. Read the staff session cookie
  const staffRole = request.cookies.get(STAFF_SESSION_COOKIE)?.value?.toLowerCase();

  // No session → redirect to /smol-backdoor login
  if (!staffRole) {
    const backdoorUrl = new URL("/smol-backdoor", request.url);
    return NextResponse.redirect(backdoorUrl);
  }

  // 5. Check role has permission for this route
  const allowedRoutes = ROLE_ROUTES[staffRole] ?? [];
  const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route));

  if (!hasAccess) {
    const backdoorUrl = new URL("/smol-backdoor", request.url);
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
  ],
};
