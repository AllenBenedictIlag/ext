"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, Mail, MoreHorizontal, RotateCcw, Info } from "lucide-react";

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/* =========================
   Types & demo data
   ========================= */

export type Interview = {
  id: string;
  when: string;
  resignee: string;
  dept: string;
  interviewer: string;
  status?: "scheduled" | "pending" | "done";
  emailConfirmedAt?: string | null;
  reminderSentAt?: string | null;
  contactEmail?: string;
  contactPhone?: string;
  manager?: string;
  employmentType?: string;
  surveyStatus?: "Not Sent" | "Sent" | "Submitted";
  notes?: string;
};

const addDays = (n: number) => String(new Date().setDate(new Date().getDate() + n));

const DEMO: Interview[] = [
  { id: "1",  when: addDays(1),  resignee: "Mara K.",   dept: "Marketing",   interviewer: "R. Chan", status: "scheduled", reminderSentAt: new Date().toISOString() },
  { id: "2",  when: addDays(2),  resignee: "Rico S.",   dept: "Engineering", interviewer: "L. Cruz", status: "scheduled", emailConfirmedAt: new Date().toISOString() },
  { id: "3",  when: addDays(3),  resignee: "Nina T.",   dept: "Operations",  interviewer: "R. Chan", status: "scheduled" },
  { id: "4",  when: addDays(4),  resignee: "Alex J.",   dept: "Finance",     interviewer: "M. Lee",  status: "scheduled" },
  { id: "5",  when: addDays(5),  resignee: "Sophia L.", dept: "IT",          interviewer: "K. Wong", status: "scheduled" },
  { id: "6",  when: addDays(6),  resignee: "Daniel P.", dept: "Sales",       interviewer: "J. Tan",  status: "scheduled" },
  { id: "7",  when: addDays(7),  resignee: "Olivia R.", dept: "HR",          interviewer: "S. Park", status: "scheduled" },
  { id: "8",  when: addDays(8),  resignee: "Ethan W.",  dept: "Operations",  interviewer: "R. Chan", status: "scheduled" },
  { id: "9",  when: addDays(9),  resignee: "Liam T.",   dept: "Engineering", interviewer: "L. Cruz", status: "scheduled" },
  { id: "10", when: addDays(10), resignee: "Emma G.",   dept: "Marketing",   interviewer: "R. Chan", status: "scheduled" },
];

/* ==============
   Utils
   ============== */

const fmtCell = (ms: string) => format(new Date(Number(ms)), "MMM dd, HH:mm");

const toLocalInputValue = (ms: string) => {
  const d = new Date(Number(ms));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInputValue = (v: string) => {
  const [date, time] = v.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
};

/* =========================
   Dialogs
   ========================= */

function RescheduleDialog({
  interview,
  onConfirm,
}: {
  interview: Interview;
  onConfirm: (newIso: string) => void;
}) {
  const [dateTime, setDateTime] = React.useState<string>(toLocalInputValue(interview.when));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 w-[112px] justify-center shrink-0">
          <RotateCcw className="size-4" /> Resched
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Reschedule interview</DialogTitle>
          <DialogDescription>
            Update the date and time for <span className="font-medium">{interview.resignee}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-4 items-center gap-3">
            <Label htmlFor={`when-${interview.id}`} className="text-right">When</Label>
            <Input
              id={`when-${interview.id}`}
              type="datetime-local"
              className="col-span-3"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onConfirm(fromLocalInputValue(dateTime))}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsDialog({
  open,
  onOpenChange,
  interview,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interview: Interview | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-4" /> Interview details
          </DialogTitle>
          <DialogDescription>Overview of the resignee and survey status.</DialogDescription>
        </DialogHeader>
        {interview && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Resignee</p>
              <p className="font-medium">{interview.resignee}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="font-medium">{interview.dept}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interviewer</p>
              <p className="font-medium">{interview.interviewer}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contact</p>
              <p className="font-medium">{interview.contactEmail ?? "—"}</p>
              <p className="font-medium">{interview.contactPhone ?? ""}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Survey status</p>
              <p className="font-medium">{interview.surveyStatus ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Notes</p>
              <p className="font-medium whitespace-pre-wrap">{interview.notes ?? "—"}</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   Main Component
   ========================= */

export default function UpcomingInterviews({ data = DEMO }: { data?: Interview[] }) {
  const [rows, setRows] = React.useState<Interview[]>(
    [...data].sort((a, b) => Number(a.when) - Number(b.when))
  );

  const [openDetails, setOpenDetails] = React.useState(false);
  const [selected, setSelected] = React.useState<Interview | null>(null);

  const handleReschedule = (id: string, newIso: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, when: String(new Date(newIso).getTime()) } : r))
    );
    toast.success("Interview rescheduled");
  };

  const handleEmail = (row: Interview) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, emailConfirmedAt: new Date().toISOString() } : r
      )
    );
    toast.message(`Confirmation sent to ${row.resignee}`);
  };

  const handleReminder = (row: Interview) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, reminderSentAt: new Date().toISOString() } : r
      )
    );
    toast.message(`Reminder sent to ${row.resignee}`);
  };

  const StatusChip = ({ row }: { row: Interview }) => (
    <div className="inline-flex items-center justify-center">
      <Badge
        variant={row.emailConfirmedAt ? "secondary" : "outline"}
        className="px-2.5 py-0.5 text-xs w-[102px] justify-center"
      >
        {row.emailConfirmedAt ? "Confirmed" : "Unconfirmed"}
      </Badge>
      {row.reminderSentAt && (
        <Badge variant="default" className="ml-2 px-2.5 py-0.5 text-xs">Reminded</Badge>
      )}
    </div>
  );

  return (
    <Card className="bg-card text-card-foreground border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 tracking-[var(--tracking-normal)] text-base">
          <CalendarDays className="size-5 text-primary" />
          <span>Upcoming Interviews</span>
          <span className="text-sm font-normal text-muted-foreground">(next 30 days)</span>
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Quick actions: reschedule, or send email confirmation.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-4">
        <div className="overflow-x-auto">
          <div className="max-h-[340px] overflow-y-auto rounded-md">
            <Table className="w-full min-w-[800px] table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-b border-border">
                  <TableHead className="w-[168px] py-2">When</TableHead>
                  <TableHead className="w-[180px] py-2">Resignee</TableHead>
                  <TableHead className="w-[160px] py-2">Dept</TableHead>
                  <TableHead className="w-[160px] py-2">Interviewer</TableHead>
                  <TableHead className="w-[220px] py-2">Status</TableHead>
                  <TableHead className="py-2 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      No upcoming interviews.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30 h-12 align-middle">
                      <TableCell className="font-medium py-2 whitespace-nowrap">{fmtCell(row.when)}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap">{row.resignee}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap">{row.dept}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap">{row.interviewer}</TableCell>
                      <TableCell className="py-2"><StatusChip row={row} /></TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex justify-end items-center gap-2 whitespace-nowrap">
                          <RescheduleDialog interview={row} onConfirm={(newIso) => handleReschedule(row.id, newIso)} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 py-1.5 w-[148px] justify-center shrink-0"
                            onClick={() => handleEmail(row)}
                            >
                                <Mail className="size-4" />
                                {row.emailConfirmedAt ? "Resend" : "Confirm"}
                            </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleReminder(row); }}>
                                {row.reminderSentAt ? "Resend reminder" : "Send reminder"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelected(row); setOpenDetails(true); }}>
                                View details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      <DetailsDialog open={openDetails} onOpenChange={setOpenDetails} interview={selected} />
    </Card>
  );
}
