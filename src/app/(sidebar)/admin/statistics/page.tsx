import { SectionCards } from "@/components/admin/dashboard/kpi-tiles";
import FeedbackFunnel from "@/components/admin/statistics/feedback-funnel";
import TrendCard from "@/components/admin/statistics/monthly-trend";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";
import FunnelCard from "@/components/admin/statistics/feedback-funnel";
import PositiveNegative from "@/components/admin/statistics/positive-negative";
import AnswerDistribution from "@/components/admin/answers/answer-distribution";
import MiniTrendPerQuestion from "@/components/admin/statistics/mini-trend";
import CompositeSatisfaction from "@/components/admin/statistics/composite-satisfaction";
import RevisitIntent from "@/components/admin/statistics/revisit-intent";
import DriverRevisit from "@/components/admin/statistics/driver-revisit";
import CumulativeUsage from "@/components/admin/statistics/cumulative-usage";
import TimeToUse from "@/components/admin/statistics/time-to-use";
import SubmissionsPattern from "@/components/admin/statistics/submissions-pattern";
import DeadlineEffect from "@/components/admin/statistics/deadline-effect";

export default function StatisticsPage(){
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <GlobalQuickFilter />
       
            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
                <FunnelCard />
                <TrendCard/>
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <AnswerDistribution/>
            <PositiveNegative/>
            </div>
            
            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
                
            <MiniTrendPerQuestion />
            </div>

            
            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <CompositeSatisfaction/>
            <RevisitIntent/>
            </div>
            
            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <DriverRevisit/>
            <TimeToUse/>
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <CumulativeUsage/>
            <DeadlineEffect/>
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <SubmissionsPattern/>
            </div>
        
        </div>
      )
}