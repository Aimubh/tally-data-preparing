/**
 * Admin bootstrap — creates (or updates) the default admin login from env.
 * Separate from the dummy-data seed: an admin is NOT dummy data, so `--clear`
 * must never wipe it. Idempotent (upsert by email).
 *
 *   ADMIN_EMAIL / ADMIN_PASSWORD come from .env.
 *   Run: npx tsx prisma/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Administrator", passwordHash },
  });

  console.log(`✔  Admin ready: ${admin.email}`);
  console.log(`   (password taken from ADMIN_PASSWORD env — change it after first login)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
