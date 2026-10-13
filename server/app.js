import express from "express";
import session from "express-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { projectRoot } from "./config.js";
import { createMailer } from "./lib/mail.js";
import { MySqlSessionStore } from "./lib/session-store.js";
import { errorHandler, HttpError } from "./lib/errors.js";
import { loadUser, protectMutations } from "./middleware/auth.js";
import { createAuthService } from "./services/auth.js";
import { authRoutes } from "./routes/auth.js";
import { catalogRoutes } from "./routes/catalog.js";

export async function createApp(pool, config, options = {}) {
  const app = express(),
    store = new MySqlSessionStore(pool);
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
        },
      },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: options.test ? 10000 : 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          message: "Too many requests. Please try again shortly.",
          code: "RATE_LIMITED",
        },
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (req, res, next) => {
    if (
      req.body !== undefined &&
      (req.body === null ||
        typeof req.body !== "object" ||
        Array.isArray(req.body))
    )
      return next(new HttpError(400, "Request body must be a JSON object."));
    req.body ||= {};
    next();
  });
  app.get("/api/health", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    session({
      name: "rmp.sid",
      secret: config.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.production,
        maxAge: 86400000,
      },
    }),
  );
  app.use("/api", protectMutations(config), loadUser(pool));
  const auth = await createAuthService(
    pool,
    config,
    options.sendOtp || createMailer(config),
  );
  app.use("/api/auth", (req, res, next) => {
    if (req.method === "GET") return next();
    return authLimiter(req, res, next);
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: options.test ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        message: "Too many authentication attempts. Try again in 15 minutes.",
        code: "RATE_LIMITED",
      },
    },
  });
  app.use("/api/auth", authRoutes(auth, config));
  app.use("/api", catalogRoutes(pool));
  app.use("/api", (req, res) =>
    res.status(404).json({
      error: { message: "API endpoint not found.", code: "NOT_FOUND" },
    }),
  );
  if (config.production)
    app.use(express.static(path.join(projectRoot, "dist")));
  app.use(errorHandler);
  return { app, store };
}
