import AnomaliesTable from "@/components/tables/anomalies-table";
import AnswersTable from "@/components/tables/answers-table";
import AuditLog from "@/components/tables/audit-log";
import QuestionsBuilder from "@/components/tables/question-builder";
import ReceiptsTable from "@/components/tables/receipts-table";
import UsersTable from "@/components/tables/users-table";
import QuestionsTable from "@/components/tables/questions-table";

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
