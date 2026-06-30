import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let user = "";
  let password = "";
  try {
    const body = await req.json();
    user = String(body.user ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifyCredentials(user, password)) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
  return res;
}
