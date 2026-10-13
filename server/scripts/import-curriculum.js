import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cseCurriculum } from "../../shared/cseCurriculum.js";
import { createPool, transaction } from "../db.js";
import { projectRoot, readConfig } from "../config.js";
import { migrate } from "./migrate.js";

// Explicit catalog replacement requested by the project owner. Account and
// professor records are preserved; links to removed courses cascade away.
export async function importCurriculum(pool) {
  await transaction(pool, async (connection) => {
    await connection.execute(
      "INSERT INTO departments (id, name, code) VALUES ('computer-science', 'Computer Science', 'CSE') ON DUPLICATE KEY UPDATE name = name",
    );
    const [departments] = await connection.execute(
      "SELECT id FROM departments WHERE name = 'Computer Science'",
    );
    const codes = cseCurriculum.map((course) => course.code);
    await connection.execute(
      `DELETE FROM courses WHERE code NOT IN (${codes.map(() => "?").join(",")})`,
      codes,
    );
    for (const course of cseCurriculum) {
      await connection.execute(
        "INSERT INTO courses (id, code, name, department_id, credits, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), department_id = VALUES(department_id), credits = VALUES(credits), semester = VALUES(semester), description = VALUES(description)",
        [
          course.id,
          course.code,
          course.name,
          departments[0].id,
          course.credits,
          course.semester,
          course.description,
        ],
      );
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let pool;
  try {
    pool = createPool(readConfig());
    const [courses] = await pool.query("SELECT * FROM courses");
    const [assignments] = await pool.query("SELECT * FROM professor_courses");
    const directory = path.join(projectRoot, ".local");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const backup = path.join(
      directory,
      `catalog-before-curriculum-${Date.now()}.json`,
    );
    await fs.writeFile(
      backup,
      JSON.stringify({ courses, assignments }, null, 2),
      { mode: 0o600 },
    );
    await migrate(pool);
    await importCurriculum(pool);
    console.log(
      `Imported ${cseCurriculum.length} CS-coded curriculum courses. Previous courses/assignments backed up to ${path.relative(projectRoot, backup)}. No reviews were added.`,
    );
  } catch (error) {
    console.error("Curriculum import failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
