import crypto from "node:crypto";

/// HMAC-SHA256 request signing per qiepass.qie.digital/integration-docs:
/// message = publicKey + timestamp, signature = HMAC-SHA256(message, apiSecret).
export function signRequest(
  publicKey: string,
  apiSecret: string,
  timestamp: string = Date.now().toString()
): Record<string, string> {
  const message = publicKey + timestamp;
  const signature = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
  return {
    "X-Public-Key": publicKey,
    "X-Signature": signature,
    "X-Timestamp": timestamp,
    "Content-Type": "application/json",
  };
}
