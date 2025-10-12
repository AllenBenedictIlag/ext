import ReceiptsTable from "@/components/tables/receipts-table";
import FeedbackFunnel from "@/components/admin/statistics/feedback-funnel";
import MonthlyTrend from "@/components/admin/statistics/monthly-trend";

export default function ReceiptsPage(){
    return(
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
                <MonthlyTrend/>
                <FeedbackFunnel/>
                <ReceiptsTable/>
            </div>
        </div>
    );
}