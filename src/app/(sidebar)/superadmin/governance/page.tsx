import { SectionCards } from "@/components/superadmin/governance/super-tiles";
import ReviewQueue from "@/components/superadmin/reviews/review-queue";

export default function GovernancePage() {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-8">
          <div className="col-span-2 md:col-span-8">
            <SectionCards/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <ReviewQueue/>
        </div>
      </div>
    )
  }