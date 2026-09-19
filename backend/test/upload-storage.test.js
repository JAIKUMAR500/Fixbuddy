import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { verifySignature, looksLikeMarkup } from "../src/utils/fileSignature.js";
import { validateUpload } from "../src/routes/upload.js";
import uploadRoutes from "../src/routes/upload.js";
import { errorHandler } from "../src/middleware/error.js";
import { isS3Configured, s3Config, s3ConfigProblems, UPLOAD_LIMITS, UPLOAD_PREFIX } from "../src/services/storage/config.js";
import { S3Storage } from "../src/services/storage/S3Storage.js";
import { LocalDiskStorage } from "../src/services/storage/LocalDiskStorage.js";
import { getStorage, resetStorage } from "../src/services/storage/index.js";
import { resetRateLimitStore } from "../src/middleware/rateLimit.js";

function dataUrl(mime, buf) {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function pngBuffer(padding = 64) {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 1),
  ]);
}

function jpegBuffer(padding = 64) {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(padding, 2)]);
}

function webmAudioBuffer(padding = 64) {
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(padding, 3)]);
}

function wavBuffer() {
  const buf = Buffer.alloc(64, 0);
  buf.write("RIFF", 0, "latin1");
  buf.write("WAVE", 8, "latin1");
  return buf;
}

test("magic bytes must agree with the declared MIME type", () => {
  assert.equal(verifySignature("image/png", pngBuffer()).ok, true);
  assert.equal(verifySignature("image/jpeg", jpegBuffer()).ok, true);
  assert.equal(verifySignature("audio/webm", webmAudioBuffer()).ok, true);
  assert.equal(verifySignature("audio/wav", wavBuffer()).ok, true);

  // A PNG header declared as JPEG is a mismatch.
  assert.equal(verifySignature("image/jpeg", pngBuffer()).ok, false);
  assert.equal(verifySignature("image/png", jpegBuffer()).ok, false);
});

test("HTML and script payloads disguised as images are rejected", () => {
  const html = Buffer.from('<!DOCTYPE html><html><script>alert("x")</script></html>');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
  assert.equal(looksLikeMarkup(html), true);
  assert.equal(looksLikeMarkup(svg), true);
  assert.equal(verifySignature("image/png", html).ok, false);
  assert.match(verifySignature("image/png", html).reason, /markup or script/i);
  assert.equal(looksLikeMarkup(pngBuffer()), false);
});

test("empty or truncated files are rejected", () => {
  assert.equal(verifySignature("image/png", Buffer.alloc(0)).ok, false);
  assert.equal(verifySignature("image/png", Buffer.from([0x89, 0x50])).ok, false);
});

test("validateUpload accepts a real image and names it safely", () => {
  const file = validateUpload({ dataUrl: dataUrl("image/png", pngBuffer()), filename: "../../etc/passwd" });
  assert.equal(file.kind, "image");
  assert.equal(file.mime, "image/png");
  // Traversal characters are stripped and the name falls back to a safe default.
  assert.match(file.name, /^\d+-[a-f0-9]{8}-photo\.png$/);
  assert.equal(file.name.includes("/"), false);
  assert.equal(file.name.includes(".."), false);

  const named = validateUpload({ dataUrl: dataUrl("image/png", pngBuffer()), filename: "kitchen-leak.png" });
  assert.match(named.name, /^\d+-[a-f0-9]{8}-kitchen-leak\.png$/);
});

test("validateUpload classifies audio and rejects unsupported types", () => {
  const voice = validateUpload({ dataUrl: dataUrl("audio/webm", webmAudioBuffer()), filename: "note" });
  assert.equal(voice.kind, "voice");
  assert.throws(() => validateUpload({ dataUrl: dataUrl("image/svg+xml", pngBuffer()) }), /not allowed/i);
  assert.throws(() => validateUpload({ dataUrl: dataUrl("audio/flac", webmAudioBuffer()) }), /Unsupported audio/i);
  assert.throws(() => validateUpload({ dataUrl: "not-a-data-url" }), /Invalid file/i);
});

test("oversized images and voice notes are rejected at the documented limits", () => {
  assert.equal(UPLOAD_LIMITS.imageBytes, 5 * 1024 * 1024);
  assert.equal(UPLOAD_LIMITS.audioBytes, 8 * 1024 * 1024);

  const bigImage = pngBuffer(UPLOAD_LIMITS.imageBytes + 16);
  assert.throws(() => validateUpload({ dataUrl: dataUrl("image/png", bigImage) }), /under 5 MB/);

  const bigAudio = webmAudioBuffer(UPLOAD_LIMITS.audioBytes + 16);
  assert.throws(() => validateUpload({ dataUrl: dataUrl("audio/webm", bigAudio) }), /under 8 MB/);

  // Just under the limit still passes.
  const okImage = pngBuffer(UPLOAD_LIMITS.imageBytes - 1024);
  assert.equal(validateUpload({ dataUrl: dataUrl("image/png", okImage) }).kind, "image");
});

test("S3 is only considered configured when bucket and both keys are present", () => {
  assert.equal(isS3Configured({}), false);
  assert.equal(isS3Configured({ S3_BUCKET: "b" }), false);
  assert.equal(isS3Configured({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k" }), false);
  assert.equal(
    isS3Configured({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" }),
    true
  );
  assert.deepEqual(s3ConfigProblems({}), ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
});

test("S3 config reads every documented environment variable", () => {
  const cfg = s3Config({
    S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    S3_BUCKET: "fixbuddy-media",
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_PUBLIC_DOMAIN: "https://cdn.fixbuddy.app/",
  });
  assert.equal(cfg.bucket, "fixbuddy-media");
  assert.equal(cfg.endpoint, "https://account.r2.cloudflarestorage.com");
  assert.equal(cfg.publicDomain, "https://cdn.fixbuddy.app");
});

test("S3 keys are namespaced by media kind and URLs prefer the public domain", () => {
  assert.equal(UPLOAD_PREFIX.image, "uploads/images/");
  assert.equal(UPLOAD_PREFIX.voice, "uploads/audio/");

  const storage = new S3Storage({
    bucket: "fixbuddy-media",
    region: "auto",
    accessKeyId: "key",
    secretAccessKey: "secret",
    endpoint: "https://account.r2.cloudflarestorage.com",
    publicDomain: "https://cdn.fixbuddy.app",
  });
  assert.equal(storage.keyFor("a.png", "image"), "uploads/images/a.png");
  assert.equal(storage.keyFor("a.webm", "voice"), "uploads/audio/a.webm");
  assert.equal(storage.publicUrlFor("uploads/images/a.png"), "https://cdn.fixbuddy.app/uploads/images/a.png");
  assert.equal(storage.durable, true);

  const noDomain = new S3Storage({
    bucket: "fixbuddy-media",
    region: "auto",
    accessKeyId: "key",
    secretAccessKey: "secret",
    endpoint: "https://account.r2.cloudflarestorage.com",
    publicDomain: "",
  });
  assert.equal(
    noDomain.publicUrlFor("uploads/audio/a.webm"),
    "https://account.r2.cloudflarestorage.com/fixbuddy-media/uploads/audio/a.webm"
  );
});

test("S3Storage.put sends the object to the bucket with a safe content disposition", async () => {
  const storage = new S3Storage({
    bucket: "fixbuddy-media",
    region: "auto",
    accessKeyId: "key",
    secretAccessKey: "secret",
    endpoint: "",
    publicDomain: "https://cdn.fixbuddy.app",
  });
  const sent = [];
  storage.client = { send: async (cmd) => { sent.push(cmd.input); return {}; } };

  const result = await storage.put({ name: "x.png", buf: pngBuffer(), mime: "image/png", kind: "image" });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].Bucket, "fixbuddy-media");
  assert.equal(sent[0].Key, "uploads/images/x.png");
  assert.equal(sent[0].ContentType, "image/png");
  assert.equal(sent[0].ContentDisposition, "inline");
  assert.equal(result.url, "https://cdn.fixbuddy.app/uploads/images/x.png");
  assert.equal(result.storage, "s3");
});

test("development falls back to local disk and reports itself as not durable", () => {
  resetStorage();
  const storage = getStorage();
  assert.equal(storage.kind, "local");
  assert.equal(storage.durable, false);
  assert.ok(storage instanceof LocalDiskStorage);
  resetStorage();
});

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("upload endpoint stores a valid image and enforces the rate limit", async () => {
  resetRateLimitStore();
  resetStorage();
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  app.use((req, _res, next) => {
    req.userId = "rate-limit-user";
    next();
  });
  app.use("/api/upload", uploadRoutes);
  app.use(errorHandler);
  const { server, url } = await listen(app);

  try {
    const body = JSON.stringify({ dataUrl: dataUrl("image/png", pngBuffer()), filename: "photo" });
    const post = () =>
      fetch(`${url}/api/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body });

    const first = await post();
    const firstBody = await first.json();
    assert.equal(first.status, 201);
    assert.equal(firstBody.kind, "image");
    assert.equal(firstBody.storage, "local");
    assert.match(firstBody.url, /\/api\/uploads\/\d+-[a-f0-9]{8}-photo\.png$/);

    // 20 per window: 19 more succeed, the 21st is throttled.
    for (let i = 0; i < 19; i++) {
      assert.equal((await post()).status, 201);
    }
    const blocked = await post();
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).message, /Too many uploads/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetRateLimitStore();
    resetStorage();
  }
});

test("upload endpoint rejects disguised HTML and oversized files over HTTP", async () => {
  resetRateLimitStore();
  resetStorage();
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  app.use((req, _res, next) => {
    req.userId = "reject-user";
    next();
  });
  app.use("/api/upload", uploadRoutes);
  app.use(errorHandler);
  const { server, url } = await listen(app);

  try {
    const send = (payload) =>
      fetch(`${url}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    const html = await send({ dataUrl: dataUrl("image/png", Buffer.from("<!DOCTYPE html><script>x</script>")) });
    assert.equal(html.status, 400);
    assert.match((await html.json()).message, /markup or script/i);

    const svg = await send({ dataUrl: dataUrl("image/svg+xml", pngBuffer()) });
    assert.equal(svg.status, 400);

    const big = await send({ dataUrl: dataUrl("image/png", pngBuffer(UPLOAD_LIMITS.imageBytes + 32)) });
    assert.equal(big.status, 400);
    assert.match((await big.json()).message, /under 5 MB/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetRateLimitStore();
    resetStorage();
  }
});
