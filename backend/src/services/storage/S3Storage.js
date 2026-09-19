import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { UPLOAD_PREFIX, s3Config } from "./config.js";

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2).
 * Objects are written under uploads/images/ and uploads/audio/.
 */
export class S3Storage {
  constructor(config = s3Config()) {
    this.config = config;
    this.client = new S3Client({
      region: config.region || "auto",
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  get kind() {
    return "s3";
  }

  get durable() {
    return true;
  }

  keyFor(name, kind) {
    return `${UPLOAD_PREFIX[kind] || UPLOAD_PREFIX.image}${name}`;
  }

  publicUrlFor(key) {
    const { publicDomain, endpoint, bucket } = this.config;
    if (publicDomain) {
      const base = publicDomain.startsWith("http") ? publicDomain : `https://${publicDomain}`;
      return `${base}/${key}`;
    }
    if (endpoint) return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
    return `https://${bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  async put({ name, buf, mime, kind }) {
    const key = this.keyFor(name, kind);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buf,
        ContentType: mime,
        // Inline rendering is never allowed for uploaded media.
        ContentDisposition: "inline",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return { url: this.publicUrlFor(key), key, storage: this.kind };
  }
}
