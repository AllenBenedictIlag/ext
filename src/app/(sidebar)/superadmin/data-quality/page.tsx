import AnswerDensity from "@/components/admin/answers/answer-density";
import AnomaliesTable from "@/components/superadmin/data-quality/anomalies-table";
import CompletionMatrix from "@/components/superadmin/data-quality/completion-matrix";
import OptionBalance from "@/components/superadmin/data-quality/option-balance";

export default function DataQualityPage() {
    return (
      <div className="p-6 text-muted-foreground">
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <CompletionMatrix/>
            <AnswerDensity height="h-90" cardClassName="md:col-span-4"/>
            <OptionBalance/>
            <AnomaliesTable/>
        </div>
      </div>
    )
  }