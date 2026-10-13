export class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError)
    return res
      .status(error.status)
      .json({ error: { message: error.message, code: error.code } });
  if (error.code === "ER_DUP_ENTRY")
    return res.status(409).json({
      error: {
        message: "That email, department, or course code already exists.",
        code: "DUPLICATE",
      },
    });
  if (error.code === "ER_ROW_IS_REFERENCED_2")
    return res.status(409).json({
      error: {
        message:
          "This record is still referenced by catalog entries or reviews. Remove its dependencies before deleting it.",
        code: "IN_USE",
      },
    });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({
      error: {
        message: "Request body must be valid JSON.",
        code: "INVALID_JSON",
      },
    });
  if (error.type === "entity.too.large")
    return res.status(413).json({
      error: { message: "Request body is too large.", code: "TOO_LARGE" },
    });
  console.error("API error:", error.code || error.name); // Never log request bodies, passwords, or OTPs.
  res.status(500).json({
    error: {
      message: "The server could not complete this request. Please try again.",
      code: "SERVER_ERROR",
    },
  });
}
