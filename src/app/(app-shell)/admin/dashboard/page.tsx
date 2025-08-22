
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import data from "./data.json"
import { ChartBarDefault } from "@/components/chart-bar-default"
import { ChartBarMixed } from "@/components/chart-bar-mixed"

export default function DashboardPage() {
  return (
    
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>


      <div className="px-4 lg:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
            <ChartBarDefault />
            <ChartBarMixed /> 
        </div>
      </div>
   
      
    </div>
  )
}