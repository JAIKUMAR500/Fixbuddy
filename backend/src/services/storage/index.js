import { env } from "../../config/env.js";
import { LocalDiskStorage } from "./LocalDiskStorage.js";
import { S3Storage } from "./S3Storage.js";
import { isS3Configured, s3ConfigProblems } from "./config.js";

let cached = null;

/**
 * S3 when configured, local disk otherwise. Production must not fall back to
 * the ephemeral container disk, so startup fails loudly instead.
 */
export function getStorage() {
  if (cached) return cached;
  if (isS3Configured()) {
    cached = new S3Storage();
    return cached;
  }
  if (env.isProduction) {
    throw new Error(
      `Object storage is not configured. Set ${s3ConfigProblems().join(", ")} before starting in production.`
    );
  }
  cached = new LocalDiskStorage();
  return cached;
}

export function resetStorage() {
  cached = null;
}

export { LocalDiskStorage } from "./LocalDiskStorage.js";
export { S3Storage } from "./S3Storage.js";
export * from "./config.js";
