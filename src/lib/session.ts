/**
 * Server-side session utility using Node's built-in crypto.
 * Signs a short token so the httpOnly cookie cannot be forged.
 * No external dependencies required.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    console.error(
      "[session] SESSION_SECRET env var is not set. " +
        "Sessions will be insecure in production. " +
        "Add SESSION_SECRET=<random-32-char-string> to your .env.local and deployment environment."
    );
  }
  return s || "dev-insecure-secret-change-me";
})();

export const COOKIE_NAME = "ops_session";
export const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Create a signed token: `timestamp.HMAC` */
export function signSession(): string {
  const ts = Date.now().toString();
  const sig = createHmac("sha256", SECRET).update(ts).digest("hex");
  return `${ts}.${sig}`;
}

/** Verify a signed token. Returns true only when signature is valid and not expired (8 h). */
export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [ts, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(ts).digest("hex");
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expBuf)) return false;
  } catch {
    return false;
  }
  // Check expiry
  const age = Date.now() - parseInt(ts, 10);
  return age > 0 && age < COOKIE_MAX_AGE * 1000;
}

/** Build the Set-Cookie header string for setting the session cookie. */
export function buildSetCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

/** Build the Set-Cookie header string for clearing the session cookie. */
export function buildClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
