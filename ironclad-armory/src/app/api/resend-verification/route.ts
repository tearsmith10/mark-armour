import { NextResponse } from "next/server";
import { resendVerification } from "@/lib/accounts";

/**
 * Re-send the verification e-mail. Always answers with the same generic
 * response so the endpoint can't be used to probe registered addresses.
 */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await resendVerification(String(body.email ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resend-verification failed:", err);
    return NextResponse.json({ ok: true });
  }
}
