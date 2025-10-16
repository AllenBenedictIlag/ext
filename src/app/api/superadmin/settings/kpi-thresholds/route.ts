import { NextResponse } from "next/server";
import {
  DEFAULT_KPI_THRESHOLDS,
  KPI_THRESHOLD_KEYS,
  type KpiThresholdKey,
  readKpiThresholds,
  upsertKpiThresholds,
} from "@/lib/kpi-thresholds";

type ThresholdPayload = {
  thresholds?: Partial<Record<KpiThresholdKey, number>>;
};

export async function GET() {
  const thresholds = await readKpiThresholds();
  return NextResponse.json({ thresholds });
}

export async function PUT(req: Request) {
  let body: ThresholdPayload;
  try {
    body = (await req.json()) as ThresholdPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !body.thresholds) {
    return NextResponse.json({ error: "Missing thresholds payload." }, { status: 400 });
  }

  const updates: Partial<Record<KpiThresholdKey, number>> = {};

  for (const key of KPI_THRESHOLD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body.thresholds, key)) {
      const raw = (body.thresholds as Record<string, unknown>)[key];
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        return NextResponse.json(
          { error: `Threshold for "${key}" must be a number.` },
          { status: 400 }
        );
      }
      if (num < 0 || num > 100) {
        return NextResponse.json(
          { error: `Threshold for "${key}" must be between 0 and 100.` },
          { status: 400 }
        );
      }
      updates[key] = Math.round(num * 10) / 10;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one valid KPI threshold to update." },
      { status: 400 }
    );
  }

  await upsertKpiThresholds(updates);
  const thresholds = await readKpiThresholds();
  return NextResponse.json({ thresholds });
}
