import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3200";
  const res = NextResponse.redirect(`${appUrl}/`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
