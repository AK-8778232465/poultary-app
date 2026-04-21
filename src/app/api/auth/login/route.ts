import { NextResponse } from "next/server";
import { isPinValid } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { pin?: string };
  const pin = body.pin?.trim() ?? "";

  if (!pin) {
    return NextResponse.json({ error: "PIN is required." }, { status: 422 });
  }

  const valid = isPinValid(pin);

  if (!valid) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
