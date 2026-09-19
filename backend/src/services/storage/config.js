/** S3-compatible storage configuration. Credentials stay server side only. */

export function s3Config(source = process.env) {
  return {
    endpoint: String(source.S3_ENDPOINT || "").trim(),
    bucket: String(source.S3_BUCKET || "").trim(),
    region: String(source.S3_REGION || "auto").trim(),
    accessKeyId: String(source.S3_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: String(source.S3_SECRET_ACCESS_KEY || "").trim(),
    publicDomain: String(source.S3_PUBLIC_DOMAIN || "").trim().replace(/\/$/, ""),
  };
}

/** Bucket plus both credentials are the minimum for a usable client. */
export function isS3Configured(source = process.env) {
  const cfg = s3Config(source);
  return Boolean(cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey);
}

export function s3ConfigProblems(source = process.env) {
  const cfg = s3Config(source);
  const problems = [];
  if (!cfg.bucket) problems.push("S3_BUCKET");
  if (!cfg.accessKeyId) problems.push("S3_ACCESS_KEY_ID");
  if (!cfg.secretAccessKey) problems.push("S3_SECRET_ACCESS_KEY");
  return problems;
}

export const UPLOAD_PREFIX = {
  image: "uploads/images/",
  voice: "uploads/audio/",
};

export const UPLOAD_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  audioBytes: 8 * 1024 * 1024,
};
