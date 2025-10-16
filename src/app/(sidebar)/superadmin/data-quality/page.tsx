import AnswerDensity from "@/components/admin/answers/answer-density";
import AnomaliesTable from "@/components/tables/anomalies-table";
import CompletionMatrix from "@/components/superadmin/data-quality/completion-matrix";
import OptionBalance from "@/components/superadmin/data-quality/option-balance";
import RequiredCoverage from "@/components/superadmin/data-quality/required-coverage";

export default function DataQualityPage() {
    return (
      <div className="max-h-dvh flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <CompletionMatrix/>
            <RequiredCoverage/>
            <AnswerDensity height="h-95" cardClassName="md:col-span-4"/>
            <OptionBalance/>
            {/* <AnomaliesTable/> */}
        </div>
      </div>
    )
  }