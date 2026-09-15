export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

function safeLogError(err) {
  const message = String(err?.message || "Server error");
  const redacted = /password|otp|token|secret|authorization|mongodb(\+srv)?:\/\/|smtp/i.test(message)
    ? "redacted diagnostic"
    : message;
  console.error(err?.name || "Error", err?.status || 500, redacted);
}

export function errorHandler(err, req, res, next) {
  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID" });
  }
  const status = err.status || 500;
  if (status >= 500) safeLogError(err);
  const hide = status >= 500 && process.env.NODE_ENV === "production";
  res.status(status).json({
    message: hide ? "Server error" : err.message || "Server error",
  });
}
