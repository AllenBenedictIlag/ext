import AnswerDensity from "@/components/admin/answers/answer-density";
import AnswerDistribution from "@/components/admin/answers/answer-distribution";
import AnswersTable from "@/components/tables/answers-table";

export default function AnswersPage(){
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <AnswerDistribution height="h-90" cardClassName="md:col-span-4"/>
            <AnswerDensity height="h-90" cardClassName="md:col-span-4"/>
          </div>
          
          <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <AnswersTable/>
          </div>
        </div>
    )
}