import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/accounts";

/**
 * Start a password reset. Generic response either way — never reveals
 * whether an address has an account.
 */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await requestPasswordReset(String(body.email ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("forgot-password failed:", err);
    return NextResponse.json({ ok: true });
  }
}
