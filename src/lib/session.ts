// src/lib/session.ts
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const AUTH_COOKIE = "auth"

/**
 * Attach the JWT to an httpOnly cookie on the response.
 * Call this right before returning your NextResponse from a route handler.
 */
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours (keep in sync with JWT exp)
  })
  return res
}

/** Clear the auth cookie (logout). */
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return res
}

/** Read the raw token string from a request (used in middleware/APIs). */
export function readTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(AUTH_COOKIE)?.value
}
