import { NextRequest, NextResponse } from "next/server";

const STAFF_SESSION_COOKIE = "smol_staff_session";

// Role → allowed routes mapping
const ROLE_ROUTES: Record<string, string[]> = {
  kitchen: ["/kitchen", "/smol-backdoor/kitchen"],
  barista: ["/barista", "/smol-backdoor/barista"],
  cashier: ["/cashier", "/smol-backdoor/cashier"],
  admin: [
    "/admin",
    "/kitchen",
    "/cashier",
    "/barista",
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
  ],
  super_admin: [
    "/admin",
    "/kitchen",
    "/cashier",
    "/barista",
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
  ],
  authenticated: [
    "/admin",
    "/kitchen",
    "/cashier",
    "/barista",
    "/smol-backdoor/admin",
    "/smol-backdoor/kitchen",
    "/smol-backdoor/cashier",
    "/smol-backdoor/barista",
  ],
};

// Protected staff routes that require authentication
const PROTECTED_PREFIXES = [
  "/kitchen",
  "/cashier",
  "/admin",
  "/barista",
  "/smol-backdoor/kitchen",
  "/smol-backdoor/cashier",
  "/smol-backdoor/admin",
  "/smol-backdoor/barista",
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

  // 2. Check if this is a protected staff route
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // 3. Read the staff session cookie
  const staffRole = request.cookies.get(STAFF_SESSION_COOKIE)?.value?.toLowerCase();

  // No session → redirect to /smol-backdoor login
  if (!staffRole) {
    const backdoorUrl = new URL("/smol-backdoor", request.url);
    return NextResponse.redirect(backdoorUrl);
  }

  // 4. Check role has permission for this route
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
