import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig, projectRoot } from "../config.js";
import { createPool, transaction } from "../db.js";
import { migrate } from "./migrate.js";

export async function importNitwCatalog(
  pool,
  catalog,
  { overwrite = true } = {},
) {
  const expected = new Set(
    catalog.departments.map((department) => department.id),
  );
  if (
    !catalog.professors.length ||
    !catalog.courses.length ||
    catalog.professors.some((p) => !expected.has(p.departmentId)) ||
    catalog.courses.some((c) => !expected.has(c.departmentId))
  )
    throw new Error("Incomplete official catalog; import aborted.");
  await transaction(pool, async (connection) => {
    const departmentIds = new Map(),
      courseIds = new Map();
    for (const department of catalog.departments) {
      const [rows] = await connection.execute(
        "SELECT id FROM departments WHERE code = ?",
        [department.code],
      );
      const identifier = rows[0]?.id || department.id;
      departmentIds.set(department.id, identifier);
      await connection.execute(
        "INSERT INTO departments (id, name, code, source_url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE " +
          (overwrite
            ? "name = VALUES(name), source_url = VALUES(source_url)"
            : "id = id"),
        [identifier, department.name, department.code, department.sourceUrl],
      );
    }
    const [existingCourses] = await connection.query(
      "SELECT id, code FROM courses",
    );
    const existingIds = new Map(
      existingCourses.map((course) => [course.code, course.id]),
    );
    for (const course of catalog.courses) {
      const identifier = existingIds.get(course.code) || course.id;
      courseIds.set(course.id, identifier);
      await connection.execute(
        "INSERT INTO courses (id, code, name, department_id, credits, semester, description, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE " +
          (overwrite
            ? "name = VALUES(name), department_id = VALUES(department_id), credits = VALUES(credits), semester = VALUES(semester), description = VALUES(description), source_url = VALUES(source_url)"
            : "id = id"),
        [
          identifier,
          course.code,
          course.name,
          departmentIds.get(course.departmentId),
          course.credits,
          course.semester,
          `Published in the NIT Warangal B.Tech curriculum, page ${course.sourcePage}.`,
          course.sourceUrl,
        ],
      );
    }
    for (const professor of catalog.professors)
      await connection.execute(
        "INSERT INTO professors (id, name, department_id, designation, office, bio, source_url) VALUES (?, ?, ?, ?, '', ?, ?) ON DUPLICATE KEY UPDATE " +
          (overwrite
            ? "name = VALUES(name), department_id = VALUES(department_id), designation = VALUES(designation), bio = VALUES(bio), source_url = VALUES(source_url)"
            : "id = id"),
        [
          professor.id,
          professor.name,
          departmentIds.get(professor.departmentId),
          professor.designation,
          "Faculty listed on the official NIT Warangal department roster.",
          professor.sourceUrl.startsWith("https://erp.nitw.ac.in/")
            ? professor.sourceUrl
            : professor.rosterUrl,
        ],
      );
    for (const assignment of catalog.assignments) {
      if (
        !courseIds.has(assignment.courseId) ||
        !catalog.professors.some((p) => p.id === assignment.professorId)
      )
        throw new Error("Invalid teaching assignment; import rolled back.");
      await connection.execute(
        "INSERT IGNORE INTO professor_courses (professor_id, course_id) VALUES (?, ?)",
        [assignment.professorId, courseIds.get(assignment.courseId)],
      );
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(readConfig());
  try {
    const catalog = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, "shared/nitwCatalog.json"),
        "utf8",
      ),
    );
    const backup = {};
    for (const table of [
      "departments",
      "professors",
      "courses",
      "professor_courses",
    ])
      backup[table] = (await pool.query(`SELECT * FROM ${table}`))[0];
    const directory = path.join(projectRoot, ".local");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(directory, `catalog-before-nitw-${Date.now()}.json`),
      JSON.stringify(backup),
      { mode: 0o600 },
    );
    await migrate(pool);
    await importNitwCatalog(pool, catalog);
    console.log(
      `Imported ${catalog.departments.length} departments, ${catalog.professors.length} professors, ${catalog.courses.length} courses, ${catalog.assignments.length} verified teaching links. Existing accounts, reviews, and manual records are preserved.`,
    );
  } catch (error) {
    console.error("NITW import failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
