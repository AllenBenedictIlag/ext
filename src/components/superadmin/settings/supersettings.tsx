// File: src/components/superadmin/settings/supersettings.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** ---------- KPI config ---------- */
const KPI_FIELDS = [
  { key: "overall_satisfaction", label: "Overall Satisfaction" },
  { key: "order_accuracy", label: "Order Accuracy" },
  { key: "staff_service", label: "Staff Service" },
  { key: "food_quality", label: "Food Quality" },
  { key: "response_rate", label: "Response Rate" },
] as const;

type KpiKey = (typeof KPI_FIELDS)[number]["key"];
type ThresholdState = Record<KpiKey, string>;

const DEFAULT_STATE: ThresholdState = KPI_FIELDS.reduce(
  (acc, { key }) => ({ ...acc, [key]: "75" }),
  {} as ThresholdState
);

/**
 * Super Admin — KPI Benchmarks Settings
 * - Client-only component; performs its own load/save to `/api/superadmin/settings/kpi-thresholds`
 * - Drop-in: <SuperAdminSettings />
 */
export default function SuperAdminSettings() {
  const [thresholds, setThresholds] = React.useState<ThresholdState>(DEFAULT_STATE);
  const [initialSnapshot, setInitialSnapshot] = React.useState<string>(JSON.stringify(DEFAULT_STATE));
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/superadmin/settings/kpi-thresholds", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const incoming = json?.thresholds ?? {};

        const next: ThresholdState = KPI_FIELDS.reduce((acc, { key }) => {
          const raw = incoming[key];
          const numeric =
            typeof raw === "number" && Number.isFinite(raw) ? raw : Number(DEFAULT_STATE[key]);
          acc[key] = String(Math.round(numeric * 10) / 10);
          return acc;
        }, {} as ThresholdState);

        if (!cancelled) {
          setThresholds(next);
          setInitialSnapshot(JSON.stringify(next));
        }
      } catch (error: any) {
        if (!cancelled) {
          toast.error("Failed to load KPI thresholds", {
            description: String(error?.message ?? error),
          });
          setThresholds(DEFAULT_STATE);
          setInitialSnapshot(JSON.stringify(DEFAULT_STATE));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = React.useMemo(
    () => initialSnapshot !== JSON.stringify(thresholds),
    [initialSnapshot, thresholds]
  );

  const handleChange = (key: KpiKey, value: string) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<KpiKey, number> = {} as Record<KpiKey, number>;
      for (const { key } of KPI_FIELDS) {
        const raw = thresholds[key];
        const numeric = Number(raw);
        if (!raw?.trim()) throw new Error(`Threshold for "${key}" cannot be empty.`);
        if (!Number.isFinite(numeric)) throw new Error(`Threshold for "${key}" must be a number.`);
        if (numeric < 0 || numeric > 100)
          throw new Error(`Threshold for "${key}" must be between 0 and 100.`);
        payload[key] = Math.round(numeric * 10) / 10;
      }

      const res = await fetch("/api/superadmin/settings/kpi-thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: payload }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const message = json?.error ?? `HTTP ${res.status}`;
        throw new Error(message);
      }

      const json = await res.json();
      const latest = json?.thresholds ?? payload;

      const next: ThresholdState = KPI_FIELDS.reduce((acc, { key }) => {
        const numeric = typeof latest[key] === "number" ? latest[key] : payload[key];
        acc[key] = String(Math.round(numeric * 10) / 10);
        return acc;
      }, {} as ThresholdState);

      setThresholds(next);
      setInitialSnapshot(JSON.stringify(next));
      toast.success("KPI thresholds updated");
    } catch (error: any) {
      toast.error("Unable to save thresholds", {
        description: String(error?.message ?? error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <Card className="max-w-2xl w-full mx-auto">
        <CardHeader>
          <CardTitle>KPI Benchmarks</CardTitle>
          <CardDescription>
            Set the minimum acceptable percentages for each KPI. Admin dashboards will highlight tiles
            in red when the latest value drops below the configured benchmark.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6">
          {KPI_FIELDS.map(({ key, label }) => (
            <div key={key} className="grid gap-2 md:grid-cols-[240px_1fr] md:items-center">
              <Label htmlFor={`threshold-${key}`} className="text-sm font-medium">
                {label}
              </Label>

              {loading ? (
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              ) : (
                <Input
                  id={`threshold-${key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.1}
                  value={thresholds[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="max-w-[180px]"
                  disabled={saving}
                />
              )}
            </div>
          ))}
        </CardContent>

        <CardFooter className="justify-between">
          <Button onClick={handleSave} disabled={loading || saving || !dirty}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
