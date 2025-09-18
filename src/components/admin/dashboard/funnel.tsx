"use client";

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
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip as RechartsTooltip,
} from "recharts";

// --- Tooltip (already referenced)
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border bg-background p-2 shadow-sm text-sm">
        <p>{payload[0].payload.name}: {payload[0].value}</p>
      </div>
    );
  }
  return null;
}

// --- Data
const stages = [
  { value: 100, name: "Issued", fill: "var(--chart-sunflower-dark)" },
  { value: 70,  name: "Used",   fill: "#83a6ed" },
  { value: 45,  name: "Submitted", fill: "#8dd1e1" },
];

export default function ConversionFunnelCard() {
  return (
    <Card className="md:col-span-2 h-80 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Issued → Used → Submitted</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart
            aria-label="Conversion funnel"
            margin={{ top: 0, right: 40, bottom: 8, left: 8 }}
          >
            <RechartsTooltip
              content={<CustomTooltip />}
              cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
              wrapperStyle={{ outline: "none" }}
            />

            <Funnel dataKey="value" data={stages} isAnimationActive>
              <LabelList position="insideTopRight" fill="var(--chart-sunflower-dark)" stroke="none" dataKey="name" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        Showing last 30 days
      </CardFooter>
    </Card>
  );
}
