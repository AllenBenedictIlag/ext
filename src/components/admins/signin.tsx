"use client";

import Image from "next/image";
import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
  
    try {
      if (mode === "signin") {
        const res = await fetch("/api/auth/admins/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error ?? "Sign in failed");
          return;
        }
  
        // json.data.role is returned by the signin API
        const role = json?.data?.role as "SUPER_ADMIN" | "ADMIN" | undefined;
  
        if (role === "SUPER_ADMIN") {
          router.push("/superadmin/superdashboard");
        } else if (role === "ADMIN") {
          router.push("/admin/dashboard");
        }
      } else {
        if (password !== confirm) {
          setError("Passwords do not match");
          return;
        }
        const res = await fetch("/api/auth/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            role: "ADMIN",
            status: "ACTIVE",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error ?? "Sign up failed");
          return;
        }
        // keep simple for now; send new admins to admin area
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }
  

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-xl shadow-xl p-0 text-card-foreground">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* RIGHT: Auth form */}
          <form onSubmit={handleSubmit} className="order-2 p-6 md:order-1 md:p-8">
            <div className="mx-auto flex max-w-sm flex-col gap-6">
              {/* Logo + title */}
              <div className="flex flex-col items-center gap-3 text-center">
                <Image
                  src="/images/coffee-black.png"
                  alt="Coffee Crave"
                  width={100}
                  height={100}
                  priority
                />
                <h1 className="text-2xl font-bold tracking-normal">
                  {mode === "signin" ? "Secure Sign-In" : "Create Account"}
                </h1>
              </div>

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              {/* Name (signup only) */}
              {mode === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Admin"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@coffeecrave.com"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password + (signin-only) Forgot link */}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <a
                      href="/auth/admins/forgot"
                      className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? "Hide" : "Show"}
                    <span className="sr-only"> password</span>
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {mode === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              )}

              {/* Primary CTA */}
              <Button type="submit" className="w-full font-semibold" disabled={busy}>
                {busy ? (mode === "signin" ? "Signing in..." : "Creating...") : mode === "signin" ? "Sign in" : "Sign up"}
              </Button>

              {/* Footer link */}
              <p className="text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    New to our system?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          </form>

          {/* LEFT: Illustration (desktop only) */}
          <div className="relative order-1 hidden min-h-[60svh] md:order-2 md:block">
            <img
              src="/images/complimentary.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/15 dark:bg-black/30" />
          </div>
        </CardContent>
      </Card>

      {/* Mobile illustration */}
      <div className="relative block h-[35vh] w-full overflow-hidden rounded-xl md:hidden">
        <img
          src="/images/complimentary.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 dark:bg-black/35" />
      </div>
    </div>
  );
}
