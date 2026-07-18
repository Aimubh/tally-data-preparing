"use server";

/**
 * Settings server actions — admin profile update.
 *
 * Security: every change is authorised by the admin's CURRENT password. Email
 * uniqueness is enforced; a new password (when given) must be confirmed and meet
 * a minimum length. On success the session cookie is re-issued so the name/email
 * carried in the JWT (shown in the sidebar) stay current. Validation is loud —
 * bad input returns a clear per-message error and nothing is changed.
 */
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  verifyPassword,
  hashPassword,
  startSession,
} from "@/lib/auth";

export interface UpdateProfileResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export async function updateProfile(
  formData: FormData
): Promise<UpdateProfileResult> {
  const session = await getCurrentAdmin();
  if (!session) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const designation = String(formData.get("designation") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  // --- Validate up front (loud, specific) ---
  if (!name) return { ok: false, error: "Name cannot be empty." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!currentPassword) {
    return { ok: false, error: "Enter your current password to save changes." };
  }
  if (newPassword || confirmPassword) {
    if (newPassword.length < MIN_PASSWORD) {
      return { ok: false, error: `New password must be at least ${MIN_PASSWORD} characters.` };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: "New password and confirmation do not match." };
    }
  }

  // --- Authorise with the current password ---
  const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
  if (!admin) {
    return { ok: false, error: "Admin account not found." };
  }
  if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
    return { ok: false, error: "Current password is incorrect." };
  }

  // --- Email uniqueness (only if it changed) ---
  if (email !== admin.email) {
    const clash = await prisma.admin.findUnique({ where: { email } });
    if (clash && clash.id !== admin.id) {
      return { ok: false, error: "That email is already in use by another admin." };
    }
  }

  // --- Apply ---
  const data: {
    name: string;
    email: string;
    designation: string | null;
    passwordHash?: string;
  } = {
    name,
    email,
    designation: designation || null,
  };
  if (newPassword) {
    data.passwordHash = await hashPassword(newPassword);
  }

  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data,
  });

  // Re-issue the session so the sidebar name/email reflect the change.
  await startSession({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
  });

  return {
    ok: true,
    message: newPassword
      ? "Profile and password updated."
      : "Profile updated.",
  };
}

// ---------------------------------------------------------------------------
// Avatar upload / removal
// ---------------------------------------------------------------------------

export interface AvatarResult {
  ok: boolean;
  error?: string;
  avatarUrl?: string | null;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE = /^image\/(png|jpe?g|webp|gif)$/;

/**
 * Upload a new profile image. Stores it in Vercel Blob when
 * BLOB_READ_WRITE_TOKEN is configured; otherwise falls back to a base64 data
 * URL saved directly on the Admin row so it works with no blob service wired.
 */
export async function updateAvatar(formData: FormData): Promise<AvatarResult> {
  const session = await getCurrentAdmin();
  if (!session) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE.test(file.type)) {
    return { ok: false, error: "Please upload a PNG, JPG, WebP or GIF image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Image is too large — keep it under 2 MB." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let avatarUrl: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Production path — Vercel Blob object storage.
    const { put } = await import("@vercel/blob");
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const blob = await put(`avatars/${session.sub}-${bytes.length}.${ext}`, bytes, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    avatarUrl = blob.url;
  } else {
    // Fallback — inline base64 data URL stored on the row (no blob service).
    avatarUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  }

  await prisma.admin.update({
    where: { id: session.sub },
    data: { avatarUrl },
  });

  return { ok: true, avatarUrl };
}

/** Remove the current profile image. */
export async function removeAvatar(): Promise<AvatarResult> {
  const session = await getCurrentAdmin();
  if (!session) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }
  await prisma.admin.update({
    where: { id: session.sub },
    data: { avatarUrl: null },
  });
  return { ok: true, avatarUrl: null };
}
