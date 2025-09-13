// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { AUTH_COOKIE } from "@/lib/session";

const SIGNIN_PATH = "/auth/admins";

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  const toSignin = (reason: "unauthenticated" | "expired" | "forbidden") => {
    const url = new URL(SIGNIN_PATH, origin);
    url.searchParams.set("from", pathname);
    url.searchParams.set("reason", reason);
    return url;
  };

  // No cookie → unauthenticated
  if (!token) {
    return NextResponse.redirect(toSignin("unauthenticated"));
  }

  // Verify cookie
  let role: "ADMIN" | "SUPER_ADMIN";
  try {
    const payload = await verifyToken(token);
    role = payload.role as "ADMIN" | "SUPER_ADMIN";
  } catch {
    // Invalid/expired token → expired
    const res = NextResponse.redirect(toSignin("expired"));
    // also clear the cookie
    res.cookies.set({ name: AUTH_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  }

  // Role gate: /superadmin/** needs SUPER_ADMIN
  if (pathname.startsWith("/superadmin") && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(toSignin("forbidden"));
  }

  // /admin/** is allowed for ADMIN and SUPER_ADMIN
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/superadmin/:path*"],
};
