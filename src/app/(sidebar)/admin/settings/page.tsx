import UserSettingsForm from "@/components/admin/settings/user-settings-form";

export default function SettingsPage(){
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
             <div className="px-4 py-4 lg:px-6">
      <UserSettingsForm />
    </div>
        </div>
    )
}