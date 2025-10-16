import type { NextRequest } from "next/server";
import { readTokenFromRequest } from "@/lib/session";
import { verifyToken } from "@/lib/auth";

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireAdminSession(req: NextRequest) {
  const token = readTokenFromRequest(req);
  if (!token) {
    throw new AuthError(401, "Unauthorized");
  }
  try {
    const payload = await verifyToken(token);
    const id = Number(payload.id);
    const role = String(payload.role ?? "").toUpperCase();
    if (!Number.isFinite(id) || !["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new AuthError(403, "Forbidden");
    }
    return {
      id,
      role: role as "ADMIN" | "SUPER_ADMIN",
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(401, "Unauthorized");
  }
}
