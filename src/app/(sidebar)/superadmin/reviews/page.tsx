
import ReviewQueue from "@/components/superadmin/reviews/review-queue";
import SurveyVersions from "@/components/superadmin/reviews/survey-versions";

export default function ReviewsPage(){
    return(
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
                <SurveyVersions/>
                <ReviewQueue/>
            </div>
        </div>
    );
}