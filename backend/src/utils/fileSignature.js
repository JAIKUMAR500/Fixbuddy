/**
 * Magic-byte validation. A declared MIME type is attacker-controlled, so the
 * bytes must agree with it before anything is stored or served.
 */

const TEXT_MARKERS = [
  "<!doctype html",
  "<html",
  "<script",
  "<svg",
  "<?xml",
  "<iframe",
  "<!entity",
];

function startsWith(buf, bytes, offset = 0) {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buf[offset + i] === byte);
}

function ascii(buf, offset, length) {
  return buf.slice(offset, offset + length).toString("latin1");
}

export function looksLikeMarkup(buf) {
  const head = buf.slice(0, 512).toString("latin1").trimStart().toLowerCase();
  return TEXT_MARKERS.some((marker) => head.startsWith(marker) || head.includes(marker));
}

const IMAGE_CHECKS = {
  "image/jpeg": (buf) => startsWith(buf, [0xff, 0xd8, 0xff]),
  "image/png": (buf) => startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/gif": (buf) => ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a",
  "image/webp": (buf) => ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WEBP",
};

function isMp3(buf) {
  if (ascii(buf, 0, 3) === "ID3") return true;
  return buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
}

function isIsoMedia(buf) {
  return ascii(buf, 4, 4) === "ftyp";
}

const AUDIO_CHECKS = {
  "audio/mpeg": isMp3,
  "audio/mp3": isMp3,
  "audio/mp4": isIsoMedia,
  "audio/x-m4a": isIsoMedia,
  "audio/aac": (buf) => isIsoMedia(buf) || (buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0),
  "audio/wav": (buf) => ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WAVE",
  "audio/wave": (buf) => ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WAVE",
  "audio/x-wav": (buf) => ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WAVE",
  "audio/webm": (buf) => startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3]),
  "audio/ogg": (buf) => ascii(buf, 0, 4) === "OggS",
};

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifySignature(mime, buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) {
    return { ok: false, reason: "File is empty or truncated." };
  }
  if (looksLikeMarkup(buf)) {
    return { ok: false, reason: "This file contains markup or script content and was rejected." };
  }
  const check = IMAGE_CHECKS[mime] || AUDIO_CHECKS[mime];
  if (!check) return { ok: false, reason: "Unsupported file type." };
  if (!check(buf)) {
    return { ok: false, reason: "File contents do not match the declared file type." };
  }
  return { ok: true };
}

export const SUPPORTED_IMAGE_MIME = Object.keys(IMAGE_CHECKS);
export const SUPPORTED_AUDIO_MIME = Object.keys(AUDIO_CHECKS);
