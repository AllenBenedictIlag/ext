"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ChartAreaInteractive } from "@/components/visualizations/chart-area-interactive";
import { SectionCards } from "@/components/visualizations/section-cards";
import { ChartBarLabelCustom } from "@/components/visualizations/sample-chart";
import { TableDemo } from "@/components/visualizations/sample-table";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";


export default function DashboardPage() {
  useEffect(() => {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
      const user = JSON.parse(saved);
      const role =
        user.role === "SUPER_ADMIN"
          ? "Super Admin"
          : user.role === "ADMIN"
          ? "Admin"
          : "User";
      toast.success(`Welcome back, ${role} ${user.last_name}`);
    }
  }, []);

  // Example: listen for filter changes (charts can do this too)
  useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent).detail;
      // console.log("filters changed:", detail);
      // TODO: trigger data reloads for charts based on detail
    }
    window.addEventListener("dashboard:filters", onFilters as any);
    return () => window.removeEventListener("dashboard:filters", onFilters as any);
  }, []);



  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <GlobalQuickFilter/>
      {/* Keep your existing content for now */}
      <SectionCards />


      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      <div className="flex flex-row gap-4 px-4 lg:px-6">
        <div className="w-7/12 flex flex-col">
          <TableDemo />
        </div>
        <div className="w-5/12 flex flex-col">
          <ChartBarLabelCustom />
        </div>
      </div>
    </div>
  );
}
