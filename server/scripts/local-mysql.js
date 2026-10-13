import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { projectRoot } from "../config.js";
const runFile = promisify(execFile);
export const localDirectory = path.join(projectRoot, ".local");
export const mysqlSocket = path.join(localDirectory, "mysql.sock");

async function findMySql() {
  const candidates = [
    process.env.MYSQLD_PATH,
    "/opt/anaconda3/bin/mysqld",
    "/opt/homebrew/opt/mysql@8.4/bin/mysqld",
    "/opt/homebrew/opt/mysql/bin/mysqld",
    "/usr/local/mysql/bin/mysqld",
  ].filter(Boolean);
  try {
    const { stdout } = await runFile("/usr/bin/which", ["mysqld"]);
    candidates.push(stdout.trim());
  } catch {}
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error(
    "MySQL Server is not installed. Install MySQL 8.4+ or set MYSQLD_PATH. See README.md.",
  );
}
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
export async function startLocalMySql() {
  await fs.mkdir(localDirectory, { recursive: true, mode: 0o700 });
  const pidFile = path.join(localDirectory, "mysql.pid");
  try {
    const pid = Number(await fs.readFile(pidFile, "utf8"));
    if (Number.isInteger(pid) && pid > 0) {
      process.kill(pid, 0);
      if (await portOpen(3307)) {
        console.log("Project MySQL is already running on 127.0.0.1:3307.");
        return;
      }
    }
  } catch {}
  if (await portOpen(3307))
    throw new Error(
      "Port 3307 is already in use. This script will not modify another MySQL instance. Configure your own DB settings instead.",
    );
  const binary = await findMySql(),
    base = path.dirname(path.dirname(binary));
  const data = path.join(localDirectory, "mysql-data");
  const log = path.join(localDirectory, "mysql.log");
  const common = [
    "--no-defaults",
    `--basedir=${base}`,
    `--datadir=${data}`,
    `--log-error=${log}`,
    `--lc-messages-dir=${path.join(base, "share", "mysql")}`,
    "--character-set-server=utf8mb4",
    "--collation-server=utf8mb4_0900_ai_ci",
  ];
  try {
    await fs.access(path.join(data, "mysql"));
  } catch {
    await fs.mkdir(data, { recursive: true, mode: 0o700 });
    console.log("Initializing a new project-only MySQL data directory…");
    try {
      await runFile(binary, [...common, "--initialize-insecure"], {
        timeout: 120000,
      });
    } catch {
      throw new Error(
        "MySQL initialization failed. Inspect .local/mysql.log. No existing database was modified.",
      );
    }
  }
  const processHandle = spawn(
    binary,
    [
      ...common,
      "--port=3307",
      "--bind-address=127.0.0.1",
      `--socket=${mysqlSocket}`,
      `--pid-file=${pidFile}`,
      "--mysqlx=OFF",
      "--skip-log-bin",
      "--innodb-buffer-pool-size=64M",
      "--max-connections=40",
    ],
    { detached: true, stdio: "ignore" },
  );
  processHandle.unref();
  let launchError;
  processHandle.once("error", (error) => {
    launchError = error;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (await portOpen(3307)) {
      console.log("Project MySQL started on 127.0.0.1:3307.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("MySQL did not become ready. Inspect .local/mysql.log.");
}
export async function stopLocalMySql() {
  const pid = Number(
    await fs.readFile(path.join(localDirectory, "mysql.pid"), "utf8"),
  );
  if (!Number.isInteger(pid) || pid < 1)
    throw new Error("Project MySQL PID is invalid.");
  // Verify ownership through the unique project data-directory argument.
  const { stdout } = await runFile("/bin/ps", [
    "-p",
    String(pid),
    "-o",
    "command=",
  ]);
  if (!stdout.includes(`--datadir=${path.join(localDirectory, "mysql-data")}`))
    throw new Error(
      "PID does not belong to this project’s MySQL. Refusing to stop it.",
    );
  process.kill(pid, "SIGTERM");
  console.log("Sent a graceful shutdown to project MySQL.");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "stop") await stopLocalMySql();
    else await startLocalMySql();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
