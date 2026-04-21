import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret } from "@/lib/env";

export const SESSION_COOKIE_NAME = "gaikwad_poultry_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function buildSignature(expiresAt: string) {
  return createHmac("sha256", getSessionSecret()).update(expiresAt).digest("hex");
}

export function createSessionToken() {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  const signature = buildSignature(expiresAt);

  return `${expiresAt}.${signature}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) {
    return false;
  }

  const [expiresAt, signature] = token.split(".");

  if (!expiresAt || !signature) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  if (Number(expiresAt) < now) {
    return false;
  }

  const expected = Buffer.from(buildSignature(expiresAt), "utf8");
  const actual = Buffer.from(signature, "utf8");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function requireAuthenticatedRequest() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}
