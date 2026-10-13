import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { readConfig, projectRoot } from "../config.js";
import { createPool } from "../db.js";
import { randomSecret } from "../lib/security.js";
import { startLocalMySql, mysqlSocket, localDirectory } from "./local-mysql.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";
import { createAdmin } from "./create-admin.js";

// This helper provisions ONLY this project's isolated local server.
// Existing .env files are respected and never rewritten.
let pool, rootConnection;
try {
  await startLocalMySql();
  const envPath = path.join(projectRoot, ".env");
  let envExists = true;
  try {
    await fs.access(envPath);
  } catch {
    envExists = false;
  }
  const rootFile = path.join(localDirectory, "mysql-root.json");
  let rootPassword = "";
  try {
    rootPassword = JSON.parse(await fs.readFile(rootFile, "utf8")).password;
  } catch {}
  rootConnection = await mysql.createConnection({
    socketPath: mysqlSocket,
    user: "root",
    password: rootPassword,
  });
  if (!rootPassword) {
    rootPassword = randomSecret();
    await rootConnection.query(
      "ALTER USER 'root'@'localhost' IDENTIFIED BY ?",
      [rootPassword],
    );
    await fs.writeFile(rootFile, JSON.stringify({ password: rootPassword }), {
      mode: 0o600,
    });
  }
  if (!envExists) {
    const dbPassword = randomSecret();
    const example = await fs.readFile(
      path.join(projectRoot, ".env.example"),
      "utf8",
    );
    const envText = example
      .replace("replace-with-your-database-password", dbPassword)
      .replace("replace-with-at-least-32-random-characters", randomSecret())
      .replaceAll("replace-with-another-independent-random-secret", () =>
        randomSecret(),
      );
    await fs.writeFile(envPath, envText, { mode: 0o600 });
    console.log(
      "Created private .env with randomly generated development secrets.",
    );
  }
  const parsed = dotenv.parse(await fs.readFile(envPath));
  const config = readConfig({ ...process.env, ...parsed });
  if (config.db.host !== "127.0.0.1" || config.db.port !== 3307)
    throw new Error(
      "Existing .env targets another server. Use db:migrate, db:seed, and admin:create with that server; setup:local will not modify it.",
    );
  if (!/^[a-zA-Z0-9_]+$/.test(config.db.user))
    throw new Error(
      "Local DB_USER must contain only letters, numbers, and underscores.",
    );
  await rootConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  await rootConnection.query(
    "CREATE USER IF NOT EXISTS ?@'127.0.0.1' IDENTIFIED BY ?",
    [config.db.user, config.db.password],
  );
  await rootConnection.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON \`${config.db.database}\`.* TO ?@'127.0.0.1'`,
    [config.db.user],
  );
  pool = createPool(config);
  // Schema upgrades use the provisioning account; the app never gets DROP privileges.
  await rootConnection.query(`USE \`${config.db.database}\``);
  await migrate(rootConnection);
  await seed(pool);
  await createAdmin(pool, parsed.ADMIN_EMAIL, parsed.ADMIN_PASSWORD);
  console.log(
    "Setup complete. Run npm run dev:server and npm run dev in separate terminals.",
  );
} catch (error) {
  console.error("Local setup failed:", error.code || error.message);
  console.error("See .local/mysql.log and README.md for troubleshooting.");
  process.exitCode = 1;
} finally {
  if (rootConnection) await rootConnection.end();
  if (pool) await pool.end();
}
