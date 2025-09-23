//src\app\(sidebar)\admin\analytics\page.tsx

import AnswerDensity from "@/components/admin/analytics/answer-density";
import CompletionMatrix from "@/components/admin/analytics/completion-matrix";
import OptionBalance from "@/components/admin/analytics/option-balance";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";

export default function AnalyticsPage() {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <GlobalQuickFilter />
        <div className="grid grid-cols-8 gap-4 px-6 md:grid-cols-8">
        <CompletionMatrix />
        <AnswerDensity />
        <OptionBalance/>
        </div>
      </div>
    )
  }