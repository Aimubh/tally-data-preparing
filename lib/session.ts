/**
 * Session tokens — signed JWTs via `jose` (edge-runtime safe, so middleware can
 * verify them). Password hashing lives separately in lib/auth.ts (Node-only,
 * bcryptjs), since middleware must not import bcrypt.
 */
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "gmis_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string; // admin id
  email: string;
  name: string;
  avatarUrl?: string | null; // profile image (Blob URL or data URL); omitted if none
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  // NOTE: a base64 data-URL avatar can be large; keep it OUT of the JWT (cookies
  // are size-limited). The sidebar reads the avatar from the DB, not the token.
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
