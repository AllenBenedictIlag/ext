import { getPool } from "@/lib/database";

export const KPI_THRESHOLD_KEYS = [
  "overall_satisfaction",
  "order_accuracy",
  "staff_service",
  "food_quality",
  "response_rate",
] as const;

export type KpiThresholdKey = (typeof KPI_THRESHOLD_KEYS)[number];

export const DEFAULT_KPI_THRESHOLDS: Record<KpiThresholdKey, number> = {
  overall_satisfaction: 75,
  order_accuracy: 75,
  staff_service: 75,
  food_quality: 75,
  response_rate: 75,
};

type ThresholdRow = {
  kpi_key: string;
  threshold_pct: number;
};

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS superadmin_kpi_thresholds (
      kpi_key VARCHAR(64) NOT NULL PRIMARY KEY,
      threshold_pct DECIMAL(6,3) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  ensured = true;
}

export async function readKpiThresholds(): Promise<Record<KpiThresholdKey, number>> {
  await ensureTable();
  const pool = getPool();
  const [rows] = await pool.query<ThresholdRow[]>(`
    SELECT kpi_key, threshold_pct
      FROM superadmin_kpi_thresholds
  `);

  const result: Record<KpiThresholdKey, number> = { ...DEFAULT_KPI_THRESHOLDS };
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row?.kpi_key) continue;
      if (KPI_THRESHOLD_KEYS.includes(row.kpi_key as KpiThresholdKey)) {
        const numeric = Number(row.threshold_pct);
        if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
          result[row.kpi_key as KpiThresholdKey] = numeric;
        }
      }
    }
  }
  return result;
}

export async function upsertKpiThresholds(
  values: Partial<Record<KpiThresholdKey, number>>
) {
  const entries = Object.entries(values).filter(([key, val]) => {
    return (
      KPI_THRESHOLD_KEYS.includes(key as KpiThresholdKey) &&
      typeof val === "number" &&
      Number.isFinite(val)
    );
  }) as [KpiThresholdKey, number][];

  if (entries.length === 0) return;

  await ensureTable();
  const pool = getPool();
  const payload = entries.map(([key, val]) => [key, val]);
  await pool.query(
    `
      INSERT INTO superadmin_kpi_thresholds (kpi_key, threshold_pct)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        threshold_pct = VALUES(threshold_pct)
    `,
    [payload]
  );
}
