import AnomaliesTable from "@/components/superadmin/data-quality/anomalies-table";
import AnswersTable from "@/components/admin/answers/answers-table";
import AuditLog from "@/components/superadmin/audit-log/audit-log";
import QuestionsBuilder from "@/components/admin/questions/question-builder";
import ReceiptsTable from "@/components/admin/receipts/receipts-table";
import UsersTable from "@/components/superadmin/users/users-table";
import QuestionsTable from "@/components/admin/questions/questions-table";

export default function QuestionsPage(){
  return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
          <QuestionsTable/>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
          <QuestionsBuilder/>
        </div>
      </div>
    )
}
