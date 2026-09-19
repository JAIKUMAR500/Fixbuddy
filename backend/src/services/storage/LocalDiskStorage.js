import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../../config/env.js";
import { httpError } from "../../utils/asyncHandler.js";
import { UPLOAD_PREFIX } from "./config.js";

const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../uploads");
const resolvedUploadDir = path.resolve(uploadDir);

function ensureDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function absoluteBase(req) {
  let base = String(env.publicUrl || "").replace(/\/$/, "");
  if (!base) {
    const proto = String(req?.get?.("x-forwarded-proto") || req?.protocol || "https")
      .split(",")[0]
      .trim();
    const host = String(req?.get?.("x-forwarded-host") || req?.get?.("host") || `localhost:${env.port}`)
      .split(",")[0]
      .trim();
    base = `${proto}://${host}`;
  }
  if (base.startsWith("http://") && !/localhost|127\.0\.0\.1/i.test(base)) {
    base = `https://${base.slice(7)}`;
  }
  return base;
}

/**
 * Development fallback. Container and serverless disks are ephemeral, so this
 * is never selected once S3 is configured.
 */
export class LocalDiskStorage {
  get kind() {
    return "local";
  }

  get durable() {
    return false;
  }

  async put({ name, buf, kind, req }) {
    ensureDir();
    const dest = path.resolve(uploadDir, name);
    if (!dest.startsWith(resolvedUploadDir + path.sep)) throw httpError(400, "Invalid file name");
    await fs.promises.writeFile(dest, buf);
    return {
      url: `${absoluteBase(req)}/api/uploads/${name}`,
      key: `${UPLOAD_PREFIX[kind] || ""}${name}`,
      storage: this.kind,
    };
  }
}

export { uploadDir, resolvedUploadDir };
