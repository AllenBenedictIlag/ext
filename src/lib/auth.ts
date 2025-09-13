// src/lib/auth.ts
import { SignJWT, jwtVerify, JWTPayload } from "jose"

const secret = new TextEncoder().encode(process.env.JWT_SECRET)
if (!process.env.JWT_SECRET) {
  // Fail fast in dev if you forgot the secret
  console.warn("[auth] JWT_SECRET is missing. Add it to .env.local")
}

export type AppRole = "ADMIN" | "SUPER_ADMIN"

export type AppTokenPayload = JWTPayload & {
  sub: string         // user id as string
  id: number          // numeric id for convenience
  role: AppRole
  email: string
  name: string        // "First Last"
}

/**
 * Sign a JWT with HS256. Default lifetime: 8 hours.
 */
export async function signToken(
  payload: Omit<AppTokenPayload, "sub"> & { sub?: string },
  expiresIn: string | number = "8h"
): Promise<string> {
  const sub = payload.sub ?? String(payload.id)
  return await new SignJWT({ ...payload, sub })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

/**
 * Verify a JWT and return its typed payload.
 * Throws if invalid/expired.
 */
export async function verifyToken(token: string): Promise<AppTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as AppTokenPayload
}
