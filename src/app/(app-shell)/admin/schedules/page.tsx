import UpcomingInterviews from "@/components/upcoming-interviews";

export default function SchedulesPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 text-muted-foreground">
      <div className="px-4 lg:px-6">
        <UpcomingInterviews />
      </div>
    </div>

    
  );
}