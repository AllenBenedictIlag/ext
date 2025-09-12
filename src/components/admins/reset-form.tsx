"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);

    if (password !== confirm) {
      setBusy(false);
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/auth/admins/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to reset password");
        return;
      }
      setMsg("Password updated. You can now sign in.");
      setTimeout(() => router.push("/admins/signin"), 800);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="mb-2 text-2xl font-semibold">Reset password</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter a new password for your account.
          </p>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {msg && <p className="mb-4 text-sm text-green-600">{msg}</p>}

          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                required
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div className="flex mt-5 -mb-6 justify-between items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save new password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/admins/signin")}
              >
                Back to sign in
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
