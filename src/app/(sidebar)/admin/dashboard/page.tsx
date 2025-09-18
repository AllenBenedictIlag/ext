// src/app/(sidebar)/admin/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";
import { SectionCards } from "@/components/admin/dashboard/section-cards";
import Scratch from "@/components/admin/dashboard/scratch";
import FunnelCard from "@/components/admin/dashboard/funnel-card";
import { MonthlyTrendCard } from "@/components/admin/dashboard/monthly-trend-card";
import ConversionFunnelCard from "@/components/admin/dashboard/funnel";
import TrendCard from "@/components/admin/dashboard/trend-card";


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
      {/* <FunnelRow/>
      <Scratch/> */}
      {/* ⬇️ Keep the same layout: 2-col + 3-col in a 5-col grid */}
      <div className="grid grid-cols-1 gap-4 px-6 md:grid-cols-5">
        <MonthlyTrendCard/>
        <FunnelCard />
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 md:grid-cols-5">
        <ConversionFunnelCard/> 
        <TrendCard/>
      </div>
    </div>
  );
}
