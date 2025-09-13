// D:\Projects\sidebar\src\components\admins\signin-signup.tsx
"use client";

import Image from "next/image";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { writeCachedUser } from "@/lib/user-cache";

export function SigninForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const search = useSearchParams();

  const [showPasswords, setShowPasswords] = React.useState(false);
  const togglePasswords = () => setShowPasswords((s) => !s);

  const [mode, setMode] = React.useState<"signin" | "signup">("signin");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // show toast if middleware redirected here with reason
  React.useEffect(() => {
    const reason = search.get("reason");
    if (!reason) return;
    const common = { id: "auth-redirect" as const };
    if (reason === "unauthenticated") {
      toast.error("Unable to load the page. Please sign in to continue.", common);
    } else if (reason === "expired") {
      toast.error("Your session expired. Please sign in again.", common);
    } else if (reason === "forbidden") {
      toast.error("You don’t have permission to access that page.", common);
    }
  }, [search]);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    // clear any server/client errors
    setError(null);
    setBusy(false);
  
    // clear all fields so we don't carry bad creds across modes
    setEmail("");
    setPassword("");
    setConfirm("");
    setFirstName("");
    setLastName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (mode === "signin") {
        // ✅ FIX: use the signin endpoint (not /api/auth/admins)
        const res = await fetch("/api/auth/admins/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const json = await res.json();

        if (!res.ok) {
          const msg = json?.error ?? "Sign in failed";
          setError(msg);
          toast.error(msg);
          return;
        }

        // cache user for instant UI (sidebar, user menu)
        writeCachedUser({
          id: json.data.id,
          firstName: json.data.first_name ?? "",
          lastName: json.data.last_name ?? "",
          email: json.data.email,
          role: json.data.role, // "ADMIN" | "SUPER_ADMIN"
        });

        const role = json?.data?.role as "SUPER_ADMIN" | "ADMIN" | undefined;
        const last = json?.data?.last_name ?? "";
        if (role === "SUPER_ADMIN") {
          toast.success(`Welcome back, Super Admin ${last} 🚀`, { id: "welcome" });
          router.push("/superadmin/superdashboard");
        } else {
          toast.success(`Welcome back, Admin ${last}`, { id: "welcome" });
          router.push("/admin/dashboard");
        }
      } else {
        // signup
        if (password !== confirm) {
          setError("Passwords do not match");
          return;
        }
        if (!firstName.trim() || !lastName.trim()) {
          setError("Please enter first and last name");
          return;
        }

        const res = await fetch("/api/auth/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            password,
            role: "ADMIN",
            status: "ACTIVE",
          }),
        });
        const json = await res.json();

        if (!res.ok) {
          const msg = json?.error ?? "Sign up failed";
          setError(msg);
          toast.error(msg);
          return;
        }

        // cache user for instant UI
        writeCachedUser({
          id: json.data.id,
          firstName: json.data.first_name ?? "",
          lastName: json.data.last_name ?? "",
          email: json.data.email,
          role: json.data.role,
        });

        const last = json?.data?.last_name ?? "";
        toast.success(`Account created! Welcome, Admin ${last} 👋`, { id: "welcome" });
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Network error";
      setError(msg);
      toast.error(msg);
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
                  {mode === "signin" ? "Sign-In" : "Create Account"}
                </h1>
              </div>

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              {/* First / Last name (signup only) */}
              {mode === "signup" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">First name</Label>
                    <Input
                      id="first_name"
                      type="text"
                      placeholder="Jane"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Last name</Label>
                    <Input
                      id="last_name"
                      type="text"
                      placeholder="Admin"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
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

              {/* Password */}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPasswords ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    aria-pressed={showPasswords}
                    aria-controls="password confirm"
                    onClick={togglePasswords}
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPasswords ? "Hide" : "Show"}
                    <span className="sr-only">toggle password visibility</span>
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {mode === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input
                    id="confirm"
                    type={showPasswords ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              )}

              {/* Primary CTA */}
              <Button type="submit" className="w-full font-semibold" disabled={busy}>
                {busy
                  ? mode === "signin"
                    ? "Signing in..."
                    : "Creating..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Sign up"}
              </Button>

              {/* Footer link */}
              <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  New to our system?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}   // <-- was setMode("signup")
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
                    onClick={() => switchMode("signin")}   // <-- was setMode("signin")
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
