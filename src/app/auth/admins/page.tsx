import { SigninForm } from "@/components/shared/signin-signup"
import { ModeToggle } from "@/components/ui/theme-button"

export default function LoginPage() {
  return (
    <div className="bg-sidebar flex max-h-dvh min-h-svh flex-col items-center justify-center p-6 md:p-10">
      
      <div className="w-full max-w-sm md:max-w-3xl">
        <div className="absolute right-6  top-6 z-50">
          <ModeToggle />
        </div>
        <SigninForm />
      </div>
    </div>
  )
}