/**
 * Node-runtime auth helpers: bcrypt password hashing/verification and reading
 * the current admin from the session cookie. NOT edge-safe (bcryptjs) — do not
 * import this from middleware; middleware uses lib/session.ts only.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Set the session cookie (HTTP-only, signed JWT). */
export async function startSession(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clear the session cookie (logout). */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read + verify the current admin from the cookie, or null. */
export async function getCurrentAdmin(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Read the current admin's DB row (incl. avatarUrl), or null. Use this when you
 * need fields not carried in the session JWT (e.g. the profile image). Imported
 * lazily to keep this module free of a hard Prisma dependency at the edge.
 */
export async function getCurrentAdminRecord() {
  const session = await getCurrentAdmin();
  if (!session) return null;
  const { prisma } = await import("./prisma");
  return prisma.admin.findUnique({ where: { id: session.sub } });
}
