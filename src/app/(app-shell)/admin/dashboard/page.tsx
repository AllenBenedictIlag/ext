
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import data from "./data.json"
import { ChartBarLabelCustom } from "@/components/sample-chart"
import { TableDemo } from "@/components/sample-table"



export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      <div className="flex flex-row 2 gap-4 px-4 lg:px-6">
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