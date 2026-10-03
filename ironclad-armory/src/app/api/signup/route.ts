import { NextResponse } from "next/server";
import { signUp } from "@/lib/accounts";

/** Create an account + send the verification e-mail. */
export async function POST(req: Request) {
  let body: { email?: string; fullName?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await signUp({
      email: String(body.email ?? ""),
      fullName: String(body.fullName ?? ""),
      password: String(body.password ?? ""),
    });
    if (!result.ok) {
      const status = result.code === "exists" ? 409 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("signup failed:", err);
    return NextResponse.json({ error: "Could not create the account. Try again." }, { status: 500 });
  }
}
