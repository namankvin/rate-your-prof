import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAccount } from "../middleware/auth.js";
import { createReviewService } from "../services/reviews.js";

export function reviewRoutes(pool, auth, options = {}) {
  const router = Router(),
    reviews = createReviewService(pool, auth);
  router.get("/reviews", async (req, res) =>
    res.json({ reviews: await reviews.list() }),
  );
  router.post(
    "/reviews",
    requireAccount,
    rateLimit({
      windowMs: 15 * 60000,
      limit: options.test ? 1000 : 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          message: "Too many submissions. Try again shortly.",
          code: "RATE_LIMITED",
        },
      },
    }),
    async (req, res) =>
      res.status(201).json(await reviews.submit(req.user, req.body)),
  );
  return router;
}
