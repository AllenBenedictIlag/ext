"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";

/**
 * PendingSchedule
 * - Themed with your globals.css tokens.
 * - Self-contained: has its own sample data for now.
 * - Can later accept props when hooked to backend.
 */

export type PendingItem = {
  id: string;
  resignee: string;
  dept: string;
  submittedAt: string | Date;
};

export default function PendingSchedule() {
  const [items] = React.useState<PendingItem[]>([
    {
      id: "1",
      resignee: "Jose L.",
      dept: "Engineering",
      submittedAt: "2025-08-27",
    },
    {
      id: "2",
      resignee: "Aria M.",
      dept: "Design",
      submittedAt: "2025-08-28",
    },
    {
      id: "3",
      resignee: "Paolo R.",
      dept: "Marketing",
      submittedAt: new Date(),
    },
    {
      id: "4",
      resignee: "Sophia L.",
      dept: "HR",
      submittedAt: new Date(),
    },
  ]);

  const fmt = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d) : d;
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (isToday) return "Today";
    return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  };

  return (
    <Card className="shadow-[var(--shadow-sm)] rounded-[var(--radius-lg)] bg-card text-card-foreground tracking-[var(--tracking-normal)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Pending Scheduling{" "}
          <span className="text-muted-foreground font-normal">
            (new submissions)
          </span>
        </CardTitle>
        <CardDescription className="sr-only">
          Auto-filled when a resignee submits the form.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-[var(--radius-md)] border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[42%] text-foreground">Resignee</TableHead>
                <TableHead className="w-[28%] text-foreground">Dept</TableHead>
                <TableHead className="w-[20%] text-foreground">Submitted</TableHead>
                <TableHead className="text-right w-[10%] text-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
          </Table>

          <ScrollArea className="h-44">
            <Table>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No pending submissions.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.id} className="hover:bg-muted/50">
                      <TableCell className="py-2">{it.resignee}</TableCell>
                      <TableCell className="py-2">{it.dept}</TableCell>
                      <TableCell className="py-2">{fmt(it.submittedAt)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-[var(--radius-md)] shadow-[var(--shadow-2xs)] px-3"
                          onClick={() => alert(`Schedule for ${it.resignee}`)}
                        >
                          Schedule
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Auto-filled when a resignee submits the form.</span>
        </div>
      </CardContent>
    </Card>
  );
}
