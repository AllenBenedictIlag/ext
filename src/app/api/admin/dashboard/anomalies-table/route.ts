// src/app/api/admin/dashboard/anomalies-table/route.ts
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/database";

// ---- Row types for internal aggregation
type AggRow = RowDataPacket & {
  question_key: string;
  question_type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  top2: number;     // LIKERT: 3/4 votes; YES_NO: YES votes
  bottom2: number;  // LIKERT: 1/2 votes; YES_NO: NO votes
  n: number;        // answered count
};

type ApiRow = {
  metric: string;            // e.g. "overall.top2_%" | "staff_service.net_score"
  entity: string;            // question_key | "composite"
  current_value: number;     // decimal (0.62 = 62%)
  previous_value: number;    // decimal
  delta: number;             // current - previous (in decimal)
  delta_pct: number | null;  // relative change, null if prev == 0
  n_current: number;         // denominator for current window
  link_to_comments: string;  // deep link suggestion
};

const clampInt = (v: string | null, fallback: number, min = 1, max = 365) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};

const clampFloat = (v: string | null, fallback: number, min = 0, max = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

// Build SQL for an inclusive [now - (offset+window) days, now - offset days) window.
// We keep everything server-side: the UI does not pass from/to.
function aggSql(offsetDays: number, windowDays: number): string {
  const start = offsetDays + windowDays; // days ago
  const end = offsetDays;                // days ago

  // NOTE:
  // - We only score LIKERT and YES_NO
  // - For LIKERT: top2 = 3/4, bottom2 = 1/2 (option_value strings)
  // - For YES_NO: top2 = YES, bottom2 = NO
  // - TEXT/SHORT_TEXT are ignored (not scored)
  return `
    SELECT
      q.question_key,
      q.question_type,
      SUM(
        CASE
          WHEN q.question_type = 'LIKERT' AND o.option_value IN ('3','4') THEN 1
          WHEN q.question_type = 'YES_NO' AND UPPER(o.option_value) = 'YES' THEN 1
          ELSE 0
        END
      ) AS top2,
      SUM(
        CASE
          WHEN q.question_type = 'LIKERT' AND o.option_value IN ('1','2') THEN 1
          WHEN q.question_type = 'YES_NO' AND UPPER(o.option_value) = 'NO' THEN 1
          ELSE 0
        END
      ) AS bottom2,
      COUNT(*) AS n
    FROM answers a
    JOIN submissions s ON s.id = a.submission_id
    JOIN questions  q ON q.id = a.question_id
    LEFT JOIN question_options o ON o.id = a.option_id
    WHERE q.question_type IN ('LIKERT','YES_NO')
      AND s.submitted_at >= DATE_SUB(NOW(), INTERVAL ${start} DAY)
      AND s.submitted_at  < DATE_SUB(NOW(), INTERVAL ${end} DAY)
    GROUP BY q.question_key, q.question_type
  `;
}

// Compute metrics for a question
function calcTop2Pct(r: AggRow | undefined): number {
  if (!r || r.n === 0) return 0;
  return r.top2 / r.n;
}
function calcNetScore(r: AggRow | undefined, type: AggRow["question_type"]): number {
  if (!r || r.n === 0) return 0;
  if (type === "LIKERT") return (r.top2 - r.bottom2) / r.n;
  // YES_NO: yes% - no%
  return (r.top2 - r.bottom2) / r.n;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const windowDays = clampInt(url.searchParams.get("windowDays"), 14, 7, 60);
    const thresholdPP = clampFloat(url.searchParams.get("thresholdPP"), 0.10, 0, 1); // e.g., 0.10 = 10pp
    const minN = clampInt(url.searchParams.get("minN"), 100, 1, 100000);
    const limit = clampInt(url.searchParams.get("limit"), 200, 1, 10000);

    const pool = getPool();

    // Current window (offset 0)
    const [cur]  = await pool.query<AggRow[]>(aggSql(0, windowDays));
    // Previous window (immediately before)
    const [prev] = await pool.query<AggRow[]>(aggSql(windowDays, windowDays));

    // Index by question_key for quick matching
    const curMap = new Map<string, AggRow>(cur.map(r => [r.question_key, r]));
    const prevMap = new Map<string, AggRow>(prev.map(r => [r.question_key, r]));

    const keys = new Set<string>([
      ...cur.map(r => r.question_key),
      ...prev.map(r => r.question_key),
    ]);

    const rows: ApiRow[] = [];

    // Per-question anomalies (Top-2% and Net)
    for (const key of keys) {
      const c = curMap.get(key);
      const p = prevMap.get(key);
      const type = c?.question_type ?? p?.question_type ?? "LIKERT";

      if (type !== "LIKERT" && type !== "YES_NO") continue;

      // Top-2%
      const currT2 = calcTop2Pct(c);
      const prevT2 = calcTop2Pct(p);
      const deltaT2 = currT2 - prevT2;
      const deltaPctT2 = prevT2 !== 0 ? deltaT2 / prevT2 : null;
      const nCurr = c?.n ?? 0;

      if (Math.abs(deltaT2) >= thresholdPP && nCurr >= minN) {
        rows.push({
          metric: `${key.includes("overall") ? "overall" : key}.top2_%`,
          entity: key === "overall" ? "composite" : key,
          current_value: currT2,
          previous_value: prevT2,
          delta: deltaT2,
          delta_pct: deltaPctT2,
          n_current: nCurr,
          link_to_comments: `/admin/comments?days=${windowDays}&q=${encodeURIComponent(
            key
          )}`,
        });
      }

      // Net score
      const currNet = calcNetScore(c, type);
      const prevNet = calcNetScore(p, type);
      const deltaNet = currNet - prevNet;
      const deltaPctNet = prevNet !== 0 ? deltaNet / prevNet : null;

      if (Math.abs(deltaNet) >= thresholdPP && nCurr >= minN) {
        rows.push({
          metric: `${key.includes("overall") ? "overall" : key}.net_score`,
          entity: key === "overall" ? "composite" : key,
          current_value: currNet,
          previous_value: prevNet,
          delta: deltaNet,
          delta_pct: deltaPctNet,
          n_current: nCurr,
          link_to_comments: `/admin/comments?days=${windowDays}&q=${encodeURIComponent(
            key
          )}`,
        });
      }
    }

    // Optional: a simple "overall" composite using totals across all LIKERT/YES_NO
    const totalize = (arr: AggRow[]) =>
      arr.reduce(
        (acc, r) => {
          if (r.question_type === "LIKERT" || r.question_type === "YES_NO") {
            acc.top2 += r.top2;
            acc.bottom2 += r.bottom2;
            acc.n += r.n;
          }
          return acc;
        },
        { top2: 0, bottom2: 0, n: 0 }
      );

    const curTot = totalize(cur);
    const prevTot = totalize(prev);
    if (curTot.n >= minN) {
      const cT2 = curTot.n ? curTot.top2 / curTot.n : 0;
      const pT2 = prevTot.n ? prevTot.top2 / prevTot.n : 0;
      const dT2 = cT2 - pT2;
      const dPctT2 = pT2 !== 0 ? dT2 / pT2 : null;

      if (Math.abs(dT2) >= thresholdPP) {
        rows.push({
          metric: "overall.top2_%",
          entity: "composite",
          current_value: cT2,
          previous_value: pT2,
          delta: dT2,
          delta_pct: dPctT2,
          n_current: curTot.n,
          link_to_comments: `/admin/comments?days=${windowDays}&q=overall`,
        });
      }

      const cNet = (curTot.top2 - curTot.bottom2) / curTot.n;
      const pNet = prevTot.n ? (prevTot.top2 - prevTot.bottom2) / prevTot.n : 0;
      const dNet = cNet - pNet;
      const dPctNet = pNet !== 0 ? dNet / pNet : null;

      if (Math.abs(dNet) >= thresholdPP) {
        rows.push({
          metric: "overall.net_score",
          entity: "composite",
          current_value: cNet,
          previous_value: pNet,
          delta: dNet,
          delta_pct: dPctNet,
          n_current: curTot.n,
          link_to_comments: `/admin/comments?days=${windowDays}&q=overall`,
        });
      }
    }

    // Sort by absolute delta (largest change first) and cap
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const limited = rows.slice(0, limit);

    return NextResponse.json(
      {
        meta: {
          windowDays,
          thresholdPP,
          minN,
          now: new Date().toISOString(),
          timezone: "Asia/Manila",
          count: limited.length,
        },
        data: limited,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("anomalies-table error:", err);
    return NextResponse.json(
      { error: "Failed to compute anomalies." },
      { status: 500 }
    );
  }
}
