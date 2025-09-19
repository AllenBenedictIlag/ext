
import CompositeSatisfactionTrend from "@/components/admin/dashboard/composite-satisfaction-trend";
import MiniTrendPerQuestion from "@/components/admin/dashboard/mini-trend-per-question";



export default function AnalyticsPage() {
    return (
      <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
        <CompositeSatisfactionTrend />
      </div>
      
    )
  }