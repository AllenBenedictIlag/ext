import { LoginForm } from "@/components/admins/signin"

export default function LoginPage() {
  return (
    <div className="bg-sidebar flex max-h-dvh min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <LoginForm />
      </div>
    </div>
  )
}