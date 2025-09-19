// src/components/admin/dashboard/sample.tsx
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
export default function SampleOutline() {
  return (
    <Card className="md:col-span-5 h-90 rounded-xl border shadow-sm bg-green-300">
      <CardHeader className="flex flex-row items-center justify-between bg-orange-300">
        <div>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Issued → Used → Submitted</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center bg-amber-400">
      </CardContent>

      <CardFooter className="px-6 text-xs bg-violet-300">
        <p>Time Span</p>
      </CardFooter>
    </Card>
  );
}
