import AnomaliesTable from "@/components/admin/analytics/anomalies-table";
import AnswersTable from "@/components/admin/analytics/answers-table";
import AuditLog from "@/components/admin/analytics/audit-log";
import ReceiptsTable from "@/components/admin/analytics/receipts-table";
import UsersTable from "@/components/admin/analytics/users-table";

export default function QuestionsPage(){
  return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
          <AnomaliesTable/>
        </div>
      </div>
    )
}