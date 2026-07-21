import { NextResponse } from "next/server";
import { spurs } from "@spurs-cloud/accounts/next";

// Sign-in entry point. There's no per-app OAuth round-trip any more: accounts
// issues one shared session cookie, so we just bounce the visitor there.
export async function GET() {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3200";
  return NextResponse.redirect(spurs().loginUrl(`${appUrl}/dashboard`));
}
