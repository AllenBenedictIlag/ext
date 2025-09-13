import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

function ok() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

// Prefer POST for mutations; also support GET for convenience.
export async function POST() {
  const res = ok();
  clearSessionCookie(res); // ✅ remove httpOnly "auth" cookie
  return res;
}

export async function GET() {
  const res = ok();
  clearSessionCookie(res); // ✅ remove httpOnly "auth" cookie
  return res;
}
