import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

const router = Router();
const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");

function ensureDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function publicUrl(req, name) {
  let base = String(env.publicUrl || "").replace(/\/$/, "");
  if (!base) {
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https")
      .split(",")[0]
      .trim();
    const host = String(req.get("x-forwarded-host") || req.get("host") || "localhost:4000")
      .split(",")[0]
      .trim();
    base = `${proto}://${host}`;
  }
  if (base.startsWith("http://") && !/localhost|127\.0\.0\.1/i.test(base)) {
    base = `https://${base.slice(7)}`;
  }
  return `${base}/api/uploads/${name}`;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "")
    .trim()
    .match(/^data:((?:image|audio)\/[a-zA-Z0-9.+-]+)(?:;charset=[^;]+)?;base64,([\s\S]+)$/);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buf: Buffer.from(match[2].replace(/\s/g, ""), "base64") };
}

function extFor(mime, isAudio) {
  if (mime.includes("svg")) return "svg";
  if (isAudio) {
    return mime.split("/")[1].replace("mpeg", "mp3").replace("x-m4a", "m4a").replace("mp4", "m4a");
  }
  return mime.split("/")[1].replace("jpeg", "jpg").replace("pjpeg", "jpg").replace("svg+xml", "svg");
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { dataUrl, filename, url } = req.body || {};
    if (url && typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
      return res.status(201).json({ url: url.trim(), kind: "image" });
    }
    if (!dataUrl || typeof dataUrl !== "string") throw httpError(400, "File data or image URL is required");
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) throw httpError(400, "Invalid file. Use JPG, PNG, WebP, SVG, or a voice recording.");
    const { mime, buf } = parsed;
    if (mime.includes("heic") || mime.includes("heif")) {
      throw httpError(400, "iPhone HEIC photos are not supported. Export as JPG, then upload.");
    }
    const isAudio = mime.startsWith("audio/");
    const ext = extFor(mime, isAudio);
    const max = isAudio ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
    if (buf.length > max) throw httpError(400, isAudio ? "Voice note must be under 8 MB" : "Image must be under 5 MB");
    ensureDir();
    const safe = String(filename || (isAudio ? "voice" : "photo"))
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/\.[^.]+$/, "")
      .slice(0, 40);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe || (isAudio ? "voice" : "photo")}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    res.status(201).json({ url: publicUrl(req, name), kind: isAudio ? "voice" : ext === "svg" ? "svg" : "image" });
  })
);

export default router;
export { uploadDir };
