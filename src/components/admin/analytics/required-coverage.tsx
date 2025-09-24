// src/components/admin/dashboard/required-coverage.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Tooltip as RechartsTooltip,
} from "recharts";

/* ---------- Component ---------- */
export default function RequiredCoverage() {
  // 🔹 Sample data — swap with your API later
  const sample = {
    coveragePct: 97.2,
    fullSubmissions: 305,
    totalSubmissions: 314,
    windowLabel: "Last 30 days (sample)",
  };

  // One row with two keys: track (100) and progress (coverage%)
  const data = [
    { name: "Coverage", track: 100, progress: sample.coveragePct },
  ];

  return (
    <Card className="md:col-span-2 h-120 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Required Coverage</CardTitle>
          <CardDescription>Submissions with all required answers</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-5rem)] relative">
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center pointer-events-none">
            <div className="text-3xl font-semibold leading-none tabular-nums">
              {sample.coveragePct.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Fully covered</div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270} // clockwise sweep (full circle)
            aria-label="Required Coverage gauge"
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />

            {/* Track ring */}
            <RadialBar
              dataKey="track"
              fill="var(--muted)"
              cornerRadius={10}
            />

            {/* Progress ring */}
            <RadialBar
              dataKey="progress"
              fill="var(--chart-1)"
              cornerRadius={10}
            />

            <RechartsTooltip
              wrapperStyle={{ outline: "none" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as typeof data[number];
                const pct = Number(row.progress ?? 0);
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
                    <div className="font-medium">Required Coverage</div>
                    <div className="mt-1">
                      <span className="tabular-nums font-semibold">
                        {pct.toFixed(1)}%
                      </span>{" "}
                      <span className="text-muted-foreground">
                        ({sample.fullSubmissions} of {sample.totalSubmissions} complete)
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        {sample.windowLabel}
      </CardFooter>
    </Card>
  );
}
