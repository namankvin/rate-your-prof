import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig, projectRoot } from "../config.js";
import { allowHalfCredits } from "../migrations/002-half-credit-courses.js";
import { removeUnusedFeatures } from "../migrations/003-remove-unused-features.js";
import { createPool } from "../db.js";

export async function migrate(pool) {
  const sql = await fs.readFile(
    path.join(projectRoot, "server", "schema.sql"),
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  await allowHalfCredits(pool);
  await removeUnusedFeatures(pool);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let pool;
  try {
    pool = createPool(readConfig());
    await migrate(pool);
    console.log("Module 1 and 2 tables are ready.");
  } catch (error) {
    console.error("Schema setup failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
