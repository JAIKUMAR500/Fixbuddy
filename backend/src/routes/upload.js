import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { rateLimit, clientKey } from "../middleware/rateLimit.js";
import { verifySignature } from "../utils/fileSignature.js";
import { getStorage, UPLOAD_LIMITS } from "../services/storage/index.js";
import { resolvedUploadDir } from "../services/storage/LocalDiskStorage.js";

const router = Router();

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_AUDIO = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
]);
const BLOCKED_EXT = new Set(["svg", "html", "htm", "js", "mjs", "cjs", "wasm", "exe", "sh", "php", "xml", "svgz"]);
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

/** 20 uploads per 15 minutes per account, falling back to IP when anonymous. */
const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: (req) => `upload:${req.userId || clientKey(req)}`,
  message: "Too many uploads. Try again in a few minutes.",
});

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "")
    .trim()
    .match(/^data:((?:image|audio)\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,([\s\S]+)$/);
  if (!match) return null;
  return { mime: match[1].toLowerCase().split(";")[0], buf: Buffer.from(match[2].replace(/\s/g, ""), "base64") };
}

function extFor(mime, isAudio) {
  if (isAudio) {
    return mime.split("/")[1].replace("mpeg", "mp3").replace("x-m4a", "m4a").replace("mp4", "m4a").replace("x-wav", "wav");
  }
  return mime.split("/")[1].replace("jpeg", "jpg").replace("pjpeg", "jpg");
}

function isAllowedRemoteUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Validates a data URL and returns the stored object descriptor.
 * Exported so tests can exercise validation without HTTP.
 */
export function validateUpload({ dataUrl, filename }) {
  if (!dataUrl || typeof dataUrl !== "string") throw httpError(400, "File data or image URL is required");
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw httpError(400, "Invalid file. Use JPG, PNG, WebP, GIF, or a voice recording.");
  const { mime, buf } = parsed;
  if (mime.includes("svg") || mime.includes("html") || mime.includes("xml")) {
    throw httpError(400, "This file type is not allowed.");
  }
  const isAudio = mime.startsWith("audio/");
  if (isAudio && !ALLOWED_AUDIO.has(mime)) throw httpError(400, "Unsupported audio type.");
  if (!isAudio && !ALLOWED_IMAGE.has(mime)) throw httpError(400, "Use JPG, PNG, WebP, or GIF.");
  if (mime.includes("heic") || mime.includes("heif")) {
    throw httpError(400, "iPhone HEIC photos are not supported. Export as JPG, then upload.");
  }
  const ext = extFor(mime, isAudio);
  if (BLOCKED_EXT.has(ext)) throw httpError(400, "This file type is not allowed.");
  const max = isAudio ? UPLOAD_LIMITS.audioBytes : UPLOAD_LIMITS.imageBytes;
  if (buf.length > max) throw httpError(400, isAudio ? "Voice note must be under 8 MB" : "Image must be under 5 MB");

  const signature = verifySignature(mime, buf);
  if (!signature.ok) throw httpError(400, signature.reason);

  const safe = String(filename || (isAudio ? "voice" : "photo"))
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[._-]{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe || (isAudio ? "voice" : "photo")}.${ext}`;
  return { name, buf, mime, kind: isAudio ? "voice" : "image" };
}

router.post(
  "/",
  uploadLimit,
  asyncHandler(async (req, res) => {
    const { dataUrl, filename, url } = req.body || {};
    if (url && typeof url === "string" && isAllowedRemoteUrl(url)) {
      return res.status(201).json({ url: url.trim(), kind: "image" });
    }
    const file = validateUpload({ dataUrl, filename });
    const stored = await getStorage().put({ ...file, req });
    res.status(201).json({ url: stored.url, kind: file.kind, storage: stored.storage });
  })
);

/** Serves files written by the local development fallback. */
export function serveUpload(req, res) {
  const name = path.basename(String(req.params.name || ""));
  if (!SAFE_NAME.test(name)) {
    return res.status(404).json({ message: "File not found" });
  }
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (BLOCKED_EXT.has(ext) || name.includes("..")) {
    return res.status(404).json({ message: "File not found" });
  }
  const full = path.resolve(resolvedUploadDir, name);
  if (!full.startsWith(resolvedUploadDir + path.sep)) {
    return res.status(404).json({ message: "File not found" });
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return res.status(404).json({ message: "File not found" });
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(full);
}

export default router;
export { resolvedUploadDir as uploadDir };
