import { randomUUID } from "node:crypto";
import { transaction } from "../db.js";
import { HttpError, requireValue } from "../lib/errors.js";
import { text, id, code } from "../lib/validation.js";

export function createCatalogService(pool) {
  async function departments() {
    const [rows] = await pool.query(
      "SELECT id, name, code FROM departments ORDER BY name",
    );
    return rows;
  }
  async function list(kind, filters = {}, connection = pool) {
    const professor = kind === "professors";
    const conditions = [],
      values = [];
    if (filters.department) {
      conditions.push("d.name = ?");
      values.push(text(filters.department, "Department", 100));
    }
    if (filters.course && professor) {
      conditions.push(
        "EXISTS (SELECT 1 FROM professor_courses pc WHERE pc.professor_id = t.id AND pc.course_id = ?)",
      );
      values.push(id(filters.course));
    }
    if (filters.q) {
      const query = text(filters.q, "Search", 120).toLowerCase();
      conditions.push(
        `(LOCATE(?, LOWER(CONCAT(t.name, ' ', d.name${professor ? "" : ", ' ', t.code"}))) > 0${professor ? " OR EXISTS (SELECT 1 FROM professor_courses pc JOIN courses c ON c.id = pc.course_id WHERE pc.professor_id = t.id AND LOCATE(?, LOWER(CONCAT(c.name, ' ', c.code))) > 0)" : ""})`,
      );
      values.push(query);
      if (professor) values.push(query);
    }
    // The table name comes from our fixed boolean, never from user input.
    const [rows] = await connection.execute(
      `SELECT t.*, d.name AS department FROM ${professor ? "professors" : "courses"} t JOIN departments d ON d.id = t.department_id ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY t.name`,
      values,
    );
    let links = [];
    if (professor)
      [links] = await connection.query(
        "SELECT professor_id, course_id FROM professor_courses ORDER BY course_id",
      );
    return rows.map((row) => {
      const common = {
        id: row.id,
        name: row.name,
        department: row.department,
        departmentId: row.department_id,
      };
      if (professor)
        return {
          ...common,
          designation: row.designation,
          office: row.office,
          bio: row.bio,
          courses: links
            .filter((link) => link.professor_id === row.id)
            .map((link) => link.course_id),
          initials: row.name
            .replace(/^Dr\.\s*/i, "")
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
        };
      return {
        ...common,
        code: row.code,
        credits: Number(row.credits),
        semester: row.semester,
        description: row.description,
      };
    });
  }
  async function find(kind, identifier) {
    id(identifier);
    const items = await list(kind);
    const item = items.find((record) => record.id === identifier);
    if (!item)
      throw new HttpError(404, "Catalog record not found.", "NOT_FOUND");
    return item;
  }
  async function departmentId(connection, name) {
    const [rows] = await connection.execute(
      "SELECT id FROM departments WHERE name = ?",
      [text(name, "Department", 100)],
    );
    requireValue(rows.length > 0, "Choose an existing department.");
    return rows[0].id;
  }
  async function save(kind, identifier, body) {
    requireValue(
      body && typeof body === "object" && !Array.isArray(body),
      "Submit a catalog object.",
    );
    const editing = Boolean(identifier);
    const recordId = identifier ? id(identifier) : randomUUID();
    const name = text(body.name, "Name", 100);
    await transaction(pool, async (connection) => {
      if (editing) {
        const [exists] = await connection.execute(
          `SELECT id FROM ${kind === "professors" ? "professors" : "courses"} WHERE id = ? FOR UPDATE`,
          [recordId],
        );
        requireValue(exists.length > 0, "Catalog record not found.", 404);
      }
      const department = await departmentId(connection, body.department);
      if (kind === "professors") {
        const designation = text(body.designation, "Designation", 50);
        requireValue(
          ["Professor", "Associate Professor", "Assistant Professor"].includes(
            designation,
          ),
          "Choose a valid designation.",
        );
        requireValue(
          Array.isArray(body.courses) && body.courses.length <= 100,
          "Courses must be a list of at most 100 course IDs.",
        );
        const courseIds = [...new Set(body.courses.map(id))];
        for (const courseId of courseIds) {
          const [rows] = await connection.execute(
            "SELECT id FROM courses WHERE id = ? FOR SHARE",
            [courseId],
          );
          requireValue(
            rows.length > 0,
            "One of the selected courses no longer exists.",
          );
        }
        const values = [
          name,
          department,
          designation,
          text(body.office || "", "Office", 100, true),
          text(body.bio || "", "Biography", 1000, true),
        ];
        if (editing)
          await connection.execute(
            "UPDATE professors SET name = ?, department_id = ?, designation = ?, office = ?, bio = ? WHERE id = ?",
            [...values, recordId],
          );
        else
          await connection.execute(
            "INSERT INTO professors (id, name, department_id, designation, office, bio) VALUES (?, ?, ?, ?, ?, ?)",
            [recordId, ...values],
          );
        await connection.execute(
          "DELETE FROM professor_courses WHERE professor_id = ?",
          [recordId],
        );
        for (const courseId of courseIds)
          await connection.execute(
            "INSERT INTO professor_courses (professor_id, course_id) VALUES (?, ?)",
            [recordId, courseId],
          );
      } else {
        requireValue(
          Number.isFinite(body.credits) &&
            Number.isInteger(body.credits * 2) &&
            body.credits >= 0.5 &&
            body.credits <= 10,
          "Credits must be from 0.5 to 10 in half-credit increments.",
        );
        requireValue(
          /^Semester [1-8]( or [1-8])?$/.test(body.semester),
          "Choose a semester from 1 to 8.",
        );
        const values = [
          code(body.code),
          name,
          department,
          body.credits,
          body.semester,
          text(body.description || "", "Description", 1000, true),
        ];
        if (editing)
          await connection.execute(
            "UPDATE courses SET code = ?, name = ?, department_id = ?, credits = ?, semester = ?, description = ? WHERE id = ?",
            [...values, recordId],
          );
        else
          await connection.execute(
            "INSERT INTO courses (id, code, name, department_id, credits, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [recordId, ...values],
          );
      }
    });
    return find(kind, recordId);
  }
  async function remove(kind, identifier) {
    id(identifier);
    const [result] = await pool.execute(
      `DELETE FROM ${kind === "professors" ? "professors" : "courses"} WHERE id = ?`,
      [identifier],
    );
    requireValue(result.affectedRows > 0, "Catalog record not found.", 404);
  }
  async function saveDepartment(identifier, body) {
    const values = [text(body.name, "Department name", 100), code(body.code)];
    const recordId = identifier ? id(identifier) : randomUUID();
    if (identifier) {
      const [result] = await pool.execute(
        "UPDATE departments SET name = ?, code = ? WHERE id = ?",
        [...values, recordId],
      );
      requireValue(result.affectedRows > 0, "Department not found.", 404);
    } else
      await pool.execute(
        "INSERT INTO departments (id, name, code) VALUES (?, ?, ?)",
        [recordId, ...values],
      );
    return { id: recordId, name: values[0], code: values[1] };
  }
  async function removeDepartment(identifier) {
    const [result] = await pool.execute(
      "DELETE FROM departments WHERE id = ?",
      [id(identifier)],
    );
    requireValue(result.affectedRows > 0, "Department not found.", 404);
  }
  async function snapshot() {
    return transaction(pool, async (connection) => {
      const [departmentRows] = await connection.query(
        "SELECT id, name, code FROM departments ORDER BY name",
      );
      return {
        departments: departmentRows,
        professors: await list("professors", {}, connection),
        courses: await list("courses", {}, connection),
      };
    });
  }
  return {
    departments,
    list,
    find,
    save,
    remove,
    saveDepartment,
    removeDepartment,
    snapshot,
  };
}
