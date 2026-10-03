import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/accounts";

/** Consume a reset token and store the new password. */
export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await resetPassword({
      token: String(body.token ?? ""),
      password: String(body.password ?? ""),
    });
    if (!result.ok) {
      const expired = /expired|invalid/i.test(result.error ?? "");
      return NextResponse.json(
        { error: result.error ?? "Could not reset the password." },
        { status: expired ? 410 : 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset-password failed:", err);
    return NextResponse.json({ error: "Could not reset the password. Try again." }, { status: 500 });
  }
}
