'use client'

import { useEffect } from "react"
import { toast } from "sonner"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import { ChartBarLabelCustom } from "@/components/sample-chart"
import { TableDemo } from "@/components/sample-table"

export default function DashboardPage() {
  useEffect(() => {
    const saved = localStorage.getItem("currentUser")
    if (saved) {
      const user = JSON.parse(saved)
      const role =
        user.role === "SUPER_ADMIN" ? "Super Admin" :
        user.role === "ADMIN" ? "Admin" : "User"

      toast.success(`Welcome back, ${role} ${user.last_name}`)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      <div className="flex flex-row gap-4 px-4 lg:px-6">
        <div className="w-7/12 flex flex-col">
          <TableDemo/>
        </div>
        <div className="w-5/12 flex flex-col">
          <ChartBarLabelCustom/>
        </div>
      </div>
    </div>
  )
}
