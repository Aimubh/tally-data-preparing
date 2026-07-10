"use server";

/**
 * Login / logout server actions. Verifies the admin's bcrypt password and, on
 * success, sets a signed HTTP-only session cookie. Validation is loud: wrong
 * credentials return a clear message (but never reveal which field was wrong).
 */
import { prisma } from "@/lib/prisma";
import { verifyPassword, startSession, endSession } from "@/lib/auth";

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function login(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Enter both email and password." };
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  // Constant-ish response: don't reveal whether the email exists.
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  await startSession({ sub: admin.id, email: admin.email, name: admin.name });
  return { ok: true };
}

export async function logout(): Promise<void> {
  await endSession();
}
