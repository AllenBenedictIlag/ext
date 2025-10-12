// src/app/api/superadmin/audit/log-export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit-log";

type Body = {
  resource: string;           // e.g. "users", "receipts", "comments"
  format: string;             // "csv" | "pdf" | "xlsx" | etc.
  rowCount: number;
  columns?: string[];
  query?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    await recordAuditEvent({
      req,
      // keep compatible with current AuditAction union
      action: "ROLE_CHANGE",
      targetType: "export",
      targetId: body.resource,
      notes: `Exported ${body.resource} as ${body.format} (rows=${body.rowCount}) cols=[${(body.columns||[]).join(",")}] q=${body.query ?? ""}`,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
