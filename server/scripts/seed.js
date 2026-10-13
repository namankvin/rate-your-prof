import { fileURLToPath } from "node:url";
import { departments } from "../../src/data/formOptions.js";
import { cseCurriculum } from "../../shared/cseCurriculum.js";
import { readConfig } from "../config.js";
import { createPool, transaction } from "../db.js";
const codes = ["CSE", "EEE", "ME", "CE", "MATH", "PHY"];
const departmentKey = (name) => name.toLowerCase().replaceAll(" ", "-");

export async function seed(pool) {
  await transaction(pool, async (connection) => {
    for (const [index, name] of departments.entries())
      await connection.execute(
        "INSERT IGNORE INTO departments (id, name, code) VALUES (?, ?, ?)",
        [departmentKey(name), name, codes[index]],
      );
    for (const course of cseCurriculum)
      await connection.execute(
        "INSERT IGNORE INTO courses (id, code, name, department_id, credits, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          course.id,
          course.code,
          course.name,
          departmentKey(course.department),
          course.credits,
          course.semester,
          course.description,
        ],
      );
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let pool;
  try {
    pool = createPool(readConfig());
    await seed(pool);
    console.log(
      "Official CSE courses inserted; no professors or reviews are seeded; existing records were not overwritten.",
    );
  } catch (error) {
    console.error("Seed failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
