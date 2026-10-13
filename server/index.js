import { readConfig } from "./config.js";
import { createPool } from "./db.js";
import { createApp } from "./app.js";

let pool;
try {
  const config = readConfig();
  pool = createPool(config);
  await pool.query("SELECT 1 FROM departments LIMIT 1");
  const { app, store } = await createApp(pool, config);
  const server = app.listen(config.port, "127.0.0.1", () =>
    console.log(
      `RateMyProf API: http://localhost:${config.port} · mail: ${config.mail.mode}`,
    ),
  );
  const cleanup = setInterval(
    () => store.prune().catch(() => console.error("Session cleanup failed.")),
    3600000,
  );
  cleanup.unref();
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      clearInterval(cleanup);
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
} catch (error) {
  console.error("Server could not start:", error.code || error.message);
  console.error(
    "Check .env, start MySQL, and run npm run db:migrate. See README.md.",
  );
  if (pool) await pool.end();
  process.exitCode = 1;
}
