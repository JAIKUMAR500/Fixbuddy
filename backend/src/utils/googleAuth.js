import { createPublicKey } from "node:crypto";
import jwt from "jsonwebtoken";
import { httpError } from "./asyncHandler.js";

function decodeJwtPart(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function verifyWithGoogleCerts(credential, audiences) {
  const [headerPart] = String(credential).split(".");
  if (!headerPart) throw new Error("malformed");
  const header = decodeJwtPart(headerPart);
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("certs");
  const { keys } = await res.json();
  const jwk = (keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const opts = {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  };
  if (audiences.length === 1) opts.audience = audiences[0];
  else if (audiences.length > 1) opts.audience = audiences;
  return jwt.verify(credential, key, opts);
}

async function verifyWithTokenInfo(credential) {
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: credential }),
  });
  if (!res.ok) {
    const get = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!get.ok) throw new Error("tokeninfo");
    return get.json();
  }
  return res.json();
}

export async function verifyGoogleIdToken(credential, clientIds) {
  const token = String(credential || "").trim();
  if (!token) throw httpError(400, "Google sign-in token is missing");
  const audiences = [...new Set(clientIds.map((id) => String(id || "").trim()).filter(Boolean))];

  let payload;
  try {
    payload = await verifyWithGoogleCerts(token, audiences);
  } catch {
    try {
      payload = await verifyWithTokenInfo(token);
    } catch {
      throw httpError(401, "Google sign-in failed. Token could not be verified.");
    }
  }

  const aud = String(payload.aud || "");
  if (audiences.length && !audiences.includes(aud)) {
    throw httpError(401, "Google client is not allowed. Use the Web client ID from Google Cloud.");
  }
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!verified) throw httpError(401, "Google email is not verified");
  const email = String(payload.email || "").toLowerCase();
  if (!email) throw httpError(400, "Google did not return an email");
  return {
    sub: String(payload.sub || ""),
    email,
    name: payload.name || "",
    picture: payload.picture || "",
  };
}
