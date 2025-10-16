import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdminSession } from "@/lib/api-auth";
import { readPreferences, upsertPreferences } from "@/lib/admin-settings-store";
import {
  DEFAULT_USER_SETTINGS,
  type ThemeChoice,
  type DateRangeChoice,
} from "@/types/settings";
import { recordAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const PreferencesSchema = z.object({
  theme: z.custom<ThemeChoice>((value) =>
    value === "LIGHT" || value === "DARK" || value === "SYSTEM"
  ),
  defaultDateRange: z.custom<DateRangeChoice>((value) =>
    value === "LAST_7" || value === "LAST_30" || value === "LAST_90" || value === "LAST_365"
  ),
});

function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession(req);
    const prefs = await readPreferences(admin.id);
    return ok({
      data: prefs ?? { ...DEFAULT_USER_SETTINGS, adminId: admin.id },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return err(error.message, error.status);
    }
    console.error("[settings.preferences] GET failed", error);
    return err("Failed to load preferences", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdminSession(req);
    const body = PreferencesSchema.parse(await req.json());
    await upsertPreferences(admin.id, body);

    await recordAuditEvent({
      req,
      action: "PREFERENCES_UPDATE",
      targetType: "admin",
      targetId: admin.id,
      notes: `Updated preferences: theme=${body.theme}, defaultDateRange=${body.defaultDateRange}`,
    });

    const prefs = await readPreferences(admin.id);
    return ok({ data: prefs ?? { ...DEFAULT_USER_SETTINGS, adminId: admin.id } });
  } catch (error) {
    if (error instanceof AuthError) {
      return err(error.message, error.status);
    }
    if (error instanceof z.ZodError) {
      return err("Invalid preferences payload", 422);
    }
    console.error("[settings.preferences] PUT failed", error);
    return err("Failed to update preferences", 500);
  }
}
