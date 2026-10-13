import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readConfig, projectRoot } from "../config.js";
import { createPool } from "../db.js";
import { email, password } from "../lib/validation.js";
import { hashPassword, randomSecret } from "../lib/security.js";

export async function createAdmin(
  pool,
  address = process.env.ADMIN_EMAIL || "admin@rate-my-prof.local",
  suppliedPassword = process.env.ADMIN_PASSWORD,
) {
  const normalized = email(address);
  const [existing] = await pool.execute(
    "SELECT role FROM users WHERE email = ?",
    [normalized],
  );
  if (existing.length) {
    if (existing[0].role !== "admin")
      throw new Error(
        "A student account already uses ADMIN_EMAIL. Choose another admin email; existing students are never silently promoted.",
      );
    console.log("Admin account already exists; password was not changed.");
    return;
  }
  const actualPassword = suppliedPassword || randomSecret();
  password(actualPassword);
  await pool.execute(
    "INSERT INTO users (id, email, password_hash, role, anonymous_seed) VALUES (?, ?, ?, 'admin', ?)",
    [
      randomUUID(),
      normalized,
      await hashPassword(actualPassword),
      randomSecret(),
    ],
  );
  const directory = path.join(projectRoot, ".local");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(
    path.join(directory, "admin-account.txt"),
    `Local RateMyProf admin account\nEmail: ${normalized}\nPassword: ${actualPassword}\n\nKeep this file private. Do not commit it.\n`,
    { mode: 0o600 },
  );
  console.log(
    "Admin created. Local credentials saved privately in .local/admin-account.txt.",
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let pool;
  try {
    pool = createPool(readConfig());
    await createAdmin(pool);
  } catch (error) {
    console.error("Admin setup failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
