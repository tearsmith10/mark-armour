import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/accounts";

/** Consume an e-mail verification token. */
export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await verifyEmail(String(body.token ?? ""));
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Invalid verification link." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, email: result.email });
  } catch (err) {
    console.error("verify-email failed:", err);
    return NextResponse.json({ error: "Could not verify the address. Try again." }, { status: 500 });
  }
}
