import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { readConfig } from "../config.js";
import { createPool } from "../db.js";
import { importNitwCatalog } from "./import-nitw.js";

export async function seed(pool) {
  const catalog = JSON.parse(
    await fs.readFile(
      new URL("../../shared/nitwCatalog.json", import.meta.url),
      "utf8",
    ),
  );
  await importNitwCatalog(pool, catalog, { overwrite: false });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(readConfig());
  try {
    await seed(pool);
    console.log(
      "Official NITW catalog seeded; existing records preserved. No reviews were added.",
    );
  } catch (error) {
    console.error("Seed failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
