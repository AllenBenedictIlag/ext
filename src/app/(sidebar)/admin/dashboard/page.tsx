// src/app/(sidebar)/admin/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";
import { SectionCards } from "@/components/admin/dashboard/kpi-tiles";
import FunnelCard from "@/components/admin/statistics/feedback-funnel";
import TrendCard from "@/components/admin/statistics/monthly-receipts";
import AnswerDistribution from "@/components/admin/statistics/answer-distribution";
import PositiveNegative from "@/components/admin/statistics/positive-negative";
import MiniTrendPerQuestion from "@/components/admin/statistics/positive-response-trend";
import RevisitIntent from "@/components/admin/statistics/revisit-intent";
import CompositeSatisfaction from "@/components/admin/statistics/composite-satisfaction";
import DriverRevisit from "@/components/admin/statistics/driver-revisit";
import TimeToUse from "@/components/admin/statistics/time-to-use";
import CumulativeUsage from "@/components/admin/statistics/cumulative-usage";
import SubmissionsPattern from "@/components/admin/statistics/submissions-pattern";
import DeadlineEffect from "@/components/admin/statistics/deadline-effect";
import CommentVolume from "@/components/admin/comments/comment-volume";


export default function DashboardPage() {
  useEffect(() => {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
      const user = JSON.parse(saved);
      const role =
        user.role === "SUPER_ADMIN" ? "Super Admin" :
        user.role === "ADMIN"       ? "Admin"       : "User";
      toast.success(`Welcome back, ${role} ${user.last_name}`);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <GlobalQuickFilter />
      <SectionCards/>

     
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <TrendCard/>
        <FunnelCard />
      </div>
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <PositiveNegative/>
        <AnswerDistribution/>
      </div>
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <MiniTrendPerQuestion />
      </div>

      
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <CompositeSatisfaction/>
      </div>
      
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <RevisitIntent/>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <DriverRevisit/>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <TimeToUse/>
        <CumulativeUsage/>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <SubmissionsPattern/>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <DeadlineEffect/>
      </div>

  
    </div>
  );
}
