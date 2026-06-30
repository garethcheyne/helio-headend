/**
 * Minimal admin auth: a single operator credential from the environment plus an
 * HMAC-signed session cookie. Deliberately small and LAN-appropriate.
 *
 * Migration path: `verifyCredentials()` is the only place that knows *how*
 * identities are checked. Swap its body for a DB user lookup (or NextAuth)
 * later without touching the cookie/session plumbing or the routes.
 */
import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "helio_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "insecure-dev-secret-change-me";
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** The single pluggable identity check. Replace this for DB-backed users. */
export function verifyCredentials(user: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USER ?? "admin";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedPass) return false; // refuse login until a password is configured
  return (
    timingSafeEqual(user, expectedUser) &&
    timingSafeEqual(password, expectedPass)
  );
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", authSecret())
    .update(payload)
    .digest("base64url");
}

/** `<base64url(json)>.<hmac>` — stateless, tamper-evident session token. */
export function createSessionToken(user: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: user, exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!timingSafeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Read the current request's cookie and report whether the admin is signed in. */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
