"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [resetUrl, setResetUrl] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    setResetUrl(null);
    try {
      const res = await fetch("/api/auth/admins/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to request reset");
        return;
      }
      setMsg(json?.message ?? "If the email exists, a reset link was generated.");
      setResetUrl(json?.resetUrl ?? null); // temporary helper
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardContent className="p-6">
          <h1 className="mb-2 text-2xl font-semibold">Forgot password</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your email and we’ll generate a reset link.
          </p>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {msg && <p className="mb-4 text-sm text-green-600">{msg}</p>}
          {resetUrl && (
            <p className="mb-4 text-sm">
              Temporary link:{" "}
              <a className="underline" href={resetUrl}>
                {resetUrl}
              </a>
            </p>
          )}

          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@coffeecrave.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Sending..." : "Send reset link"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push("/admins/signin")}>
                Back to sign in
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
