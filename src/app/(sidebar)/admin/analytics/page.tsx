
import CompositeSatisfactionTrend from "@/components/admin/dashboard/composite-satisfaction-trend";
import MiniTrendPerQuestion from "@/components/admin/dashboard/mini-trend-per-question";
import RevisitIntent from "@/components/admin/dashboard/revisit-intent";



export default function AnalyticsPage() {
    return (
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <RevisitIntent/>
      </div>
      
    )
  }