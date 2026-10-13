import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { readConfig, projectRoot } from "../config.js";
import { createPool } from "../db.js";
import { migrate } from "../scripts/migrate.js";
import { cseCurriculum } from "../../shared/cseCurriculum.js";
import { importCurriculum } from "../scripts/import-curriculum.js";
import { seed } from "../scripts/seed.js";
import { createApp } from "../app.js";
import { hashPassword, randomSecret } from "../lib/security.js";
import { createAuthService } from "../services/auth.js";

test("Modules 1 and 2 against real MySQL in an isolated test database", async (t) => {
  const database = `rmp_test_${process.pid}`,
    testUser = `rmp_test_${process.pid}`,
    testPassword = randomSecret();
  const rootPassword = JSON.parse(
    await fs.readFile(path.join(projectRoot, ".local/mysql-root.json"), "utf8"),
  ).password;
  const root = await mysql.createConnection({
    socketPath: path.join(projectRoot, ".local/mysql.sock"),
    user: "root",
    password: rootPassword,
  });
  let pool, server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    await root.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await root.query("DROP USER IF EXISTS ?@'127.0.0.1'", [testUser]);
    await root.end();
  });
  await root.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
  await root.query("CREATE USER ?@'127.0.0.1' IDENTIFIED BY ?", [
    testUser,
    testPassword,
  ]);
  await root.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON \`${database}\`.* TO ?@'127.0.0.1'`,
    [testUser],
  );
  const config = readConfig({
    ...process.env,
    APP_ENV: "development",
    NODE_ENV: "test",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3307",
    DB_NAME: database,
    DB_USER: testUser,
    DB_PASSWORD: testPassword,
    MAIL_MODE: "file",
  });
  pool = createPool(config);
  await migrate(pool);
  await seed(pool);
  assert.equal((await pool.query("SELECT id FROM professors"))[0].length, 0);
  // Explicit test-only fixtures; application seeding never creates professors.
  await pool.query(
    "INSERT INTO professors (id, name, department_id, designation, bio) VALUES ('test-teacher-one', 'Test Teacher One', 'computer-science', 'Professor', 'Test only'), ('test-teacher-two', 'Test Teacher Two', 'computer-science', 'Professor', 'Test only')",
  );
  await pool.query(
    "INSERT INTO professor_courses (professor_id, course_id) VALUES ('test-teacher-one', 'cs1206'), ('test-teacher-two', 'cs1206')",
  );
  const delivered = [],
    sendOtp = async (message) => delivered.push(message);
  const { app } = await createApp(pool, config, { test: true, sendOtp });
  server = await new Promise((resolve) => {
    const result = app.listen(0, "127.0.0.1", () => resolve(result));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  class Client {
    constructor(apiBase = base) {
      this.base = apiBase;
    }
    cookie = "";
    csrf = "";
    async call(method, route, body, expected = 200, extras = {}) {
      const response = await fetch(`${this.base}${route}`, {
        method,
        headers: {
          Cookie: this.cookie,
          Origin: config.origin,
          "Content-Type": "application/json",
          ...(method !== "GET" ? { "X-CSRF-Token": this.csrf } : {}),
          ...extras,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      for (const value of response.headers.getSetCookie())
        if (value.startsWith("rmp.sid=")) this.cookie = value.split(";")[0];
      const data = await response.json();
      assert.equal(
        response.status,
        expected,
        `${method} ${route}: ${JSON.stringify(data)}`,
      );
      if (data.csrfToken) this.csrf = data.csrfToken;
      return { data, headers: response.headers };
    }
  }
  const guest = new Client(),
    student = new Client(),
    admin = new Client();
  await guest.call("GET", "/auth/session");
  await student.call("GET", "/auth/session");
  await admin.call("GET", "/auth/session");
  const address = "test.student@student.nitw.ac.in",
    originalPassword = "original-test-password",
    newPassword = "replacement-test-password";
  const adminId = randomUUID();
  await pool.execute(
    "INSERT INTO users (id, email, password_hash, role, anonymous_seed) VALUES (?, ?, ?, 'admin', ?)",
    [
      adminId,
      "admin@rmp-test.local",
      await hashPassword("integration-admin-password"),
      randomSecret(),
    ],
  );
  const adminLogin = await admin.call("POST", "/auth/login", {
    email: "admin@rmp-test.local",
    password: "integration-admin-password",
  });
  assert.match(adminLogin.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(adminLogin.headers.get("set-cookie"), /SameSite=Lax/i);
  let departmentId, courseId, professorId;

  await t.test(
    "public catalog search works without exposing account fields",
    async () => {
      const { data } = await guest.call("GET", "/catalog");
      assert.equal(data.professors.length, 2);
      assert.equal(data.courses.length, cseCurriculum.length);
      assert.equal(JSON.stringify(data).includes("password_hash"), false);
      assert.equal(JSON.stringify(data).includes("anonymous_seed"), false);
      const search = await guest.call("GET", "/professors?q=CS1206");
      assert.equal(search.data.professors.length, 2);
      assert.equal(
        (await guest.call("GET", "/courses?department=Electrical")).data.courses
          .length,
        0,
      );
      await guest.call("GET", "/professors/no-such-professor", undefined, 404);
    },
  );
  await t.test(
    "CSRF and role controls reject unauthorized catalog changes",
    async () => {
      await guest.call(
        "POST",
        "/departments",
        { name: "Blocked", code: "BLOCK" },
        403,
        { "X-CSRF-Token": "incorrect" },
      );
      await guest.call(
        "POST",
        "/departments",
        { name: "Blocked", code: "BLOCK" },
        403,
        { Origin: "https://attacker.example" },
      );
      await guest.call(
        "POST",
        "/departments",
        { name: "Blocked", code: "BLOCK" },
        401,
      );
    },
  );
  await t.test(
    "admin creates and updates departments, courses, and teaching links atomically",
    async () => {
      departmentId = (
        await admin.call(
          "POST",
          "/departments",
          { name: "Test Department", code: "TEST" },
          201,
        )
      ).data.department.id;
      courseId = (
        await admin.call(
          "POST",
          "/courses",
          {
            name: "Integration Course",
            code: "TEST 101",
            department: "Test Department",
            credits: 4,
            semester: "Semester 1",
            description: "A test.",
          },
          201,
        )
      ).data.item.id;
      professorId = (
        await admin.call(
          "POST",
          "/professors",
          {
            name: "Dr. Integration",
            department: "Test Department",
            designation: "Professor",
            office: "Room 1",
            bio: "A test.",
            courses: [courseId],
          },
          201,
        )
      ).data.item.id;
      await admin.call(
        "DELETE",
        `/departments/${departmentId}`,
        undefined,
        409,
      );
      await admin.call(
        "PUT",
        `/professors/${professorId}`,
        {
          name: "Dr. Invalid Update",
          department: "Test Department",
          designation: "Professor",
          courses: ["missing-course"],
        },
        400,
      );
      assert.equal(
        (await guest.call("GET", `/professors/${professorId}`)).data.professor
          .name,
        "Dr. Integration",
      );
      await admin.call("PUT", `/departments/${departmentId}`, {
        name: "Renamed Department",
        code: "TEST",
      });
      assert.equal(
        (await guest.call("GET", `/courses/${courseId}`)).data.course
          .department,
        "Renamed Department",
      );
      await admin.call(
        "POST",
        "/courses",
        {
          name: "Duplicate",
          code: "TEST 101",
          department: "Renamed Department",
          credits: 3,
          semester: "Semester 1",
          description: "",
        },
        409,
      );
    },
  );
  await t.test(
    "registration validates domain, consent, password, duplicate account, and role assignment",
    async () => {
      await student.call(
        "POST",
        "/auth/register",
        { email: "wrong@gmail.com", password: originalPassword, agreed: true },
        400,
      );
      await student.call(
        "POST",
        "/auth/register",
        { email: address, password: "short", agreed: true },
        400,
      );
      await student.call(
        "POST",
        "/auth/register",
        { email: address, password: originalPassword, agreed: false },
        400,
      );
      const result = await student.call(
        "POST",
        "/auth/register",
        {
          email: address.toUpperCase(),
          password: originalPassword,
          agreed: true,
          role: "admin",
        },
        201,
      );
      assert.equal(result.data.email, address);
      assert.equal(result.data.otp, undefined);
      await student.call(
        "POST",
        "/auth/register",
        { email: address, password: originalPassword, agreed: true },
        409,
      );
      const [rows] = await pool.execute(
        "SELECT role, password_hash FROM users WHERE email = ?",
        [address],
      );
      assert.equal(rows[0].role, "student");
      assert.notEqual(rows[0].password_hash, originalPassword);
      await student.call(
        "POST",
        "/auth/login",
        { email: address, password: originalPassword },
        200,
      );
    },
  );
  await t.test(
    "Password reset attempt count persists, expiry is enforced, and a consumed code cannot be reused",
    async () => {
      await student.call("POST", "/auth/forgot-password", { email: address });
      const message = delivered.find((m) => m.to === address);
      const wrong = message.otp === "000000" ? "000001" : "000000";
      await student.call(
        "POST",
        "/auth/reset-password",
        { email: address, code: wrong, password: originalPassword },
        400,
      );
      const [rows] = await pool.execute(
        "SELECT attempts FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = ?)",
        [address],
      );
      assert.equal(rows[0].attempts, 1);
      await student.call(
        "POST",
        "/auth/forgot-password",
        { email: address },
        429,
      );
      await pool.execute(
        "UPDATE password_resets SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)",
        [Date.now() - 1000, address],
      );
      await student.call(
        "POST",
        "/auth/reset-password",
        { email: address, code: message.otp, password: originalPassword },
        400,
      );
      await pool.execute(
        "UPDATE password_resets SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)",
        [Date.now() + 600000, address],
      );
      await student.call("POST", "/auth/reset-password", {
        email: address,
        code: message.otp,
        password: originalPassword,
      });
      await student.call("GET", "/auth/session");
      await student.call(
        "POST",
        "/auth/reset-password",
        { email: address, code: message.otp, password: originalPassword },
        400,
      );
      await student.call("GET", "/auth/session");
    },
  );
  await t.test(
    "login rotates the session ID; students cannot edit the catalog",
    async () => {
      const oldCookie = student.cookie;
      await student.call("POST", "/auth/login", {
        email: address,
        password: originalPassword,
      });
      assert.notEqual(student.cookie, oldCookie);
      const session = await student.call("GET", "/auth/session");
      assert.equal(session.data.user.role, "student");
      await student.call(
        "POST",
        "/departments",
        { name: "Blocked", code: "BLOCK" },
        403,
      );
      await student.call(
        "GET",
        `/auth/review-eligibility?professorId=${professorId}&courseId=${courseId}`,
      );
      await student.call(
        "GET",
        `/auth/review-eligibility?professorId=${professorId}&courseId=cs1101`,
        undefined,
        400,
      );
    },
  );
  await t.test(
    "private review keys are stable per context and never returned to the client",
    async () => {
      const [users] = await pool.execute(
        "SELECT id FROM users WHERE email = ?",
        [address],
      );
      const service = await createAuthService(pool, config, sendOtp);
      const key = await service.reviewIdentity(
        users[0].id,
        professorId,
        courseId,
      );
      assert.equal(
        key,
        await service.reviewIdentity(users[0].id, professorId, courseId),
      );
      const result = await student.call(
        "GET",
        `/auth/review-eligibility?professorId=${professorId}&courseId=${courseId}`,
      );
      assert.equal(JSON.stringify(result.data).includes(key), false);
    },
  );
  await t.test(
    "password reset consumes its code and invalidates all old sessions",
    async () => {
      await student.call("POST", "/auth/forgot-password", { email: address });
      const resetMessage = delivered.findLast((m) => m.to === address);
      const otherDevice = new Client();
      await otherDevice.call("GET", "/auth/session");
      await otherDevice.call("POST", "/auth/login", {
        email: address,
        password: originalPassword,
      });
      await student.call("POST", "/auth/reset-password", {
        email: address,
        code: resetMessage.otp,
        password: newPassword,
      });
      assert.equal(
        (await otherDevice.call("GET", "/auth/session")).data.user,
        null,
      );
      await student.call("GET", "/auth/session");
      await student.call(
        "POST",
        "/auth/reset-password",
        { email: address, code: resetMessage.otp, password: newPassword },
        400,
      );
      await student.call(
        "POST",
        "/auth/login",
        { email: address, password: originalPassword },
        401,
      );
      await student.call("POST", "/auth/login", {
        email: address,
        password: newPassword,
      });
    },
  );
  await t.test(
    "logout removes server session; deletes cascade only teaching links",
    async () => {
      await student.call("POST", "/auth/logout");
      assert.equal(
        (await student.call("GET", "/auth/session")).data.user,
        null,
      );
      await student.call(
        "GET",
        `/auth/review-eligibility?professorId=${professorId}&courseId=${courseId}`,
        undefined,
        401,
      );
      await admin.call("DELETE", `/courses/${courseId}`);
      assert.deepEqual(
        (await guest.call("GET", `/professors/${professorId}`)).data.professor
          .courses,
        [],
      );
      await admin.call("DELETE", `/professors/${professorId}`);
      await admin.call("DELETE", `/departments/${departmentId}`);
    },
  );
  await t.test(
    "five wrong guesses exhaust a reset code, and resending replaces the previous code",
    async () => {
      const address2 = "locked.student@student.nitw.ac.in";
      await guest.call(
        "POST",
        "/auth/register",
        { email: address2, password: originalPassword, agreed: true },
        201,
      );
      await guest.call("POST", "/auth/forgot-password", { email: address2 });
      const old = delivered.findLast((m) => m.to === address2);
      const wrong = old.otp === "111111" ? "222222" : "111111";
      for (let i = 0; i < 5; i++)
        await guest.call(
          "POST",
          "/auth/reset-password",
          { email: address2, code: wrong, password: originalPassword },
          400,
        );
      await guest.call(
        "POST",
        "/auth/reset-password",
        { email: address2, code: old.otp, password: originalPassword },
        400,
      );
      await pool.execute(
        "UPDATE password_resets SET sent_at = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)",
        [Date.now() - 61000, address2],
      );
      await guest.call("POST", "/auth/forgot-password", { email: address2 });
      const fresh = delivered.findLast((m) => m.to === address2);
      await guest.call("POST", "/auth/reset-password", {
        email: address2,
        code: fresh.otp,
        password: originalPassword,
      });
    },
  );
  await t.test(
    "signup sends no code and duplicate registration cannot overwrite an account",
    async () => {
      const client = new Client();
      await client.call("GET", "/auth/session");
      const email = "direct.student@student.nitw.ac.in";
      const before = delivered.length;
      await client.call(
        "POST",
        "/auth/register",
        { email, password: originalPassword, agreed: true, role: "admin" },
        201,
      );
      assert.equal(delivered.length, before);
      const duplicate = await client.call(
        "POST",
        "/auth/register",
        { email: email.toUpperCase(), password: newPassword, agreed: true },
        409,
      );
      assert.equal(duplicate.data.error.code, "ACCOUNT_EXISTS");
      await client.call(
        "POST",
        "/auth/login",
        { email, password: newPassword },
        401,
      );
      const login = await client.call("POST", "/auth/login", {
        email,
        password: originalPassword,
      });
      assert.equal(login.data.user.role, "student");
      await client.call(
        "POST",
        "/departments",
        { name: "Forbidden", code: "NO" },
        403,
      );
      await client.call("POST", "/auth/logout");
    },
  );
  await t.test(
    "half-credit migration and official CSE import preserve the curriculum and existing valid assignments",
    async () => {
      await pool.query("DELETE FROM courses WHERE credits < 1");
      await pool.query(
        "ALTER TABLE courses DROP CHECK chk_courses_credits, MODIFY COLUMN credits TINYINT UNSIGNED NOT NULL, ADD CONSTRAINT legacy_credits CHECK (credits BETWEEN 1 AND 10)",
      );
      await migrate(pool);
      await migrate(pool); // Re-running the migration must be safe.
      await importCurriculum(pool);
      await importCurriculum(pool); // Official assignments survive a repeated import.
      const catalog = (await guest.call("GET", "/catalog")).data;
      assert.equal(catalog.courses.length, cseCurriculum.length);
      assert.deepEqual(
        catalog.courses.map((c) => c.code).sort(),
        cseCurriculum.map((c) => c.code).sort(),
      );
      for (const expected of cseCurriculum) {
        const actual = catalog.courses.find((c) => c.code === expected.code);
        assert.equal(actual.name, expected.name);
        assert.equal(actual.credits, expected.credits);
        assert.equal(actual.semester, expected.semester);
        assert.equal(actual.department, "Computer Science");
        assert.equal(actual.isSample, undefined);
      }
      assert.ok(
        catalog.professors
          .find((p) => p.id === "test-teacher-one")
          .courses.includes("cs1206"),
      );
      const body = {
        code: "TESTHALF",
        name: "Half credit test",
        department: "Computer Science",
        credits: 0.5,
        semester: "Semester 7 or 8",
        description: "",
      };
      await admin.call("POST", "/courses", { ...body, credits: 0.25 }, 400);
      const saved = (await admin.call("POST", "/courses", body, 201)).data.item;
      assert.equal(saved.credits, 0.5);
      await admin.call("DELETE", `/courses/${saved.id}`);
    },
  );
  await t.test(
    "cleanup migration preserves accounts, catalog and reset codes and can run twice",
    async () => {
      const [before] = await pool.query(
        "SELECT id, password_hash, anonymous_seed FROM users ORDER BY id",
      );
      const [catalogBefore] = await pool.query(
        "SELECT id, code FROM courses ORDER BY id",
      );
      await root.query(`USE \`${database}\``);
      await root.query("ALTER TABLE users ADD verified_at DATETIME NULL");
      await root.query(
        "ALTER TABLE professors ADD is_sample BOOLEAN NOT NULL DEFAULT FALSE",
      );
      await root.query(
        "ALTER TABLE courses ADD is_sample BOOLEAN NOT NULL DEFAULT FALSE",
      );
      await root.query(`CREATE TABLE auth_challenges (
      user_id CHAR(36) NOT NULL, purpose ENUM('verify','reset') NOT NULL,
      code_hash CHAR(64) NOT NULL, expires_at BIGINT UNSIGNED NOT NULL,
      sent_at BIGINT UNSIGNED NOT NULL, attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id,purpose), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
      const resetHash = "a".repeat(64);
      await root.query(
        "INSERT INTO auth_challenges VALUES (?, 'reset', ?, ?, ?, 2), (?, 'verify', ?, ?, ?, 0)",
        [
          adminId,
          resetHash,
          Date.now() + 600000,
          Date.now(),
          adminId,
          "b".repeat(64),
          Date.now() + 600000,
          Date.now(),
        ],
      );
      await migrate(root);
      await migrate(root);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT id, password_hash, anonymous_seed FROM users ORDER BY id",
          )
        )[0],
        before,
      );
      assert.deepEqual(
        (await pool.query("SELECT id, code FROM courses ORDER BY id"))[0],
        catalogBefore,
      );
      const [resets] = await pool.query(
        "SELECT code_hash, attempts FROM password_resets WHERE user_id = ?",
        [adminId],
      );
      assert.deepEqual(resets, [{ code_hash: resetHash, attempts: 2 }]);
      assert.equal(
        (await pool.query("SHOW TABLES LIKE 'auth_challenges'"))[0].length,
        0,
      );
      for (const [table, column] of [
        ["users", "verified_at"],
        ["professors", "is_sample"],
        ["courses", "is_sample"],
      ]) {
        assert.equal(
          (await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]))[0]
            .length,
          0,
        );
      }
    },
  );
});
