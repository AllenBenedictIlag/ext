import type { NextRequest } from "next/server";
import { getPool } from "@/lib/database";
import { verifyToken } from "@/lib/auth";
import { readTokenFromRequest } from "@/lib/session";
import type {
  AdminLoginEventInput,
  AuditAction,
  RecordAuditEventInput,
} from "@/types/audit-log";

type Nullable<T> = T | null | undefined;

const IP_HEADERS = ["x-forwarded-for", "x-real-ip"];

function extractIp(req?: NextRequest): string | null {
  if (!req) return null;
  for (const header of IP_HEADERS) {
    const value = req.headers.get(header);
    if (value) {
      return value.split(",")[0]?.trim() || null;
    }
  }
  return null;
}

function extractUserAgent(req?: NextRequest): string | null {
  if (!req) return null;
  return req.headers.get("user-agent");
}

async function resolveActorId(
  req: Nullable<NextRequest>,
  provided?: Nullable<number>
): Promise<number | null> {
  if (typeof provided === "number" && Number.isFinite(provided)) {
    return provided;
  }
  if (!req) return null;
  try {
    const token = readTokenFromRequest(req);
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload?.id) return null;
    const id = Number(payload.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

async function insertAuditRow(
  action: AuditAction,
  actorAdminId: number,
  targetType: string,
  targetId: number | string,
  notes: Nullable<string>,
  ip: Nullable<string>,
  userAgent: Nullable<string>
) {
  const pool = getPool();
  try {
    await pool.execute(
      `
      INSERT INTO audit_logs (
        actor_admin_id,
        action,
        target_type,
        target_id,
        notes,
        ip,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        actorAdminId,
        action,
        targetType,
        String(targetId),
        notes ?? null,
        ip ?? null,
        userAgent ?? null,
      ]
    );
  } catch (err) {
    console.error("[audit-log] failed to insert audit row", err);
  }
}

export async function recordAuditEvent(input: RecordAuditEventInput) {
  const { req, actorAdminId, action, targetType, targetId, notes } = input;
  const actorId = await resolveActorId(req, actorAdminId);
  if (!actorId) return;
  const ip = extractIp(req);
  const userAgent = extractUserAgent(req);
  await insertAuditRow(action, actorId, targetType, targetId, notes, ip, userAgent);
}

export async function recordAdminLogin(input: AdminLoginEventInput) {
  const { req, adminId } = input;
  const ip = extractIp(req);
  const userAgent = extractUserAgent(req);
  const pool = getPool();

  try {
    await pool.execute(
      `
      INSERT INTO admin_logins (
        admin_id,
        ip,
        user_agent
      )
      VALUES (?, ?, ?)
    `,
      [adminId, ip ?? null, userAgent ?? null]
    );
  } catch (err) {
    console.error("[audit-log] failed to record admin login", err);
  }
}
