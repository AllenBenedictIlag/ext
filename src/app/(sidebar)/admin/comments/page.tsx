import RecentComments from "@/components/admin/comments/recent-comments";
import CommentVolume from "@/components/admin/comments/comment-volume";
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter";


export default function CommentsPage() {
  return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <GlobalQuickFilter />
          <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <CommentVolume/>
          </div>
          <div className="grid grid-cols-8 gap-4 px-6 md:grid-cols-8">
            <RecentComments/>
          </div>
        </div>
  );
}
