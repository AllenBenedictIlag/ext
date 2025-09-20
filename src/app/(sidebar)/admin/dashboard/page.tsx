// src/app/(sidebar)/admin/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";
import { SectionCards } from "@/components/admin/dashboard/section-cards";
import FunnelCard from "@/components/admin/dashboard/funnel-card";
import TrendCard from "@/components/admin/dashboard/trend-card";
import AnswerDistribution from "@/components/admin/dashboard/answer-distribution";
import PositiveNegative from "@/components/admin/dashboard/positive-negative";
import MiniTrendPerQuestion from "@/components/admin/dashboard/mini-trend-per-question";
import CompositeSatisfactionTrend from "@/components/admin/dashboard/composite-satisfaction-trend";
import RevisitIntent from "@/components/admin/dashboard/revisit-intent";


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
        <CompositeSatisfactionTrend />
      </div>
      
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <RevisitIntent/>
      </div>
    </div>
  );
}
