import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Public routes reachable WITHOUT a session. Everything else requires login.
const PUBLIC_PATHS = ["/login", "/welcome"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Signed-in admin hitting /login → send to the dashboard.
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Unauthenticated visitor to a protected route → send to /login (remember
  // where they were headed).
  if (!session && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Run on everything except Next internals, API routes, and static files.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
