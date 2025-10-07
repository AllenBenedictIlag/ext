import type { NextRequest } from "next/server";

export const AUDIT_ACTIONS = [
  "SIGN_IN",
  "DRAFT_EDIT",
  "SUBMIT_FOR_REVIEW",
  "PUBLISH",
  "ARCHIVE",
  "ROLE_CHANGE",
  "EXPORT",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogRecord extends Record<string, unknown> {
  time: string;
  actor: string;
  action: AuditAction;
  target: string;
  notes: string;
  ip: string | null;
  user_agent: string | null;
}

export interface AuditLogResponse {
  data: AuditLogRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  meta: Record<string, unknown>;
}

export interface RecordAuditEventInput {
  req?: NextRequest;
  actorAdminId?: number;
  action: AuditAction;
  targetType: string;
  targetId: number | string;
  notes?: string | null;
}

export interface AdminLoginEventInput {
  req?: NextRequest;
  adminId: number;
}
