
import CompositeSatisfactionTrend from "@/components/admin/dashboard/composite-satisfaction";
import DriverRevisit from "@/components/admin/dashboard/driver-revisit";
import MiniTrendPerQuestion from "@/components/admin/dashboard/positive-response-trend";
import RevisitIntent from "@/components/admin/dashboard/revisit-intent";



export default function AnalyticsPage() {
    return (
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <DriverRevisit/>
      </div>
      
    )
  }