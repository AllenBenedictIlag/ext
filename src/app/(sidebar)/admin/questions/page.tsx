import SurveyVersions from "@/components/admin/analytics/survey-versions";
import QuestionsTable from "@/components/admin/tables/questions";

export default function QuestionsPage(){
  return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
          <SurveyVersions/>
        </div>
      </div>
    )
}