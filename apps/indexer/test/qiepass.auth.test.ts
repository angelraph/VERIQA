import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { signRequest } from "../src/qiepass/auth";

describe("signRequest", () => {
  it("matches an independently computed HMAC-SHA256 signature", () => {
    const publicKey = "pk_test_abc123xyz";
    const apiSecret = "sk_test_supersecret";
    const timestamp = "1744531200000";

    const headers = signRequest(publicKey, apiSecret, timestamp);

    const expectedSignature = crypto
      .createHmac("sha256", apiSecret)
      .update(publicKey + timestamp)
      .digest("hex");

    expect(headers["X-Signature"]).toBe(expectedSignature);
    expect(headers["X-Public-Key"]).toBe(publicKey);
    expect(headers["X-Timestamp"]).toBe(timestamp);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("produces a different signature for a different secret", () => {
    const a = signRequest("pk_test_abc", "secret-one", "123");
    const b = signRequest("pk_test_abc", "secret-two", "123");
    expect(a["X-Signature"]).not.toBe(b["X-Signature"]);
  });

  it("produces a different signature for a different timestamp", () => {
    const a = signRequest("pk_test_abc", "secret", "111");
    const b = signRequest("pk_test_abc", "secret", "222");
    expect(a["X-Signature"]).not.toBe(b["X-Signature"]);
  });

  it("defaults to the current time when no timestamp is given", () => {
    const before = Date.now();
    const headers = signRequest("pk_test_abc", "secret");
    const after = Date.now();
    const ts = Number(headers["X-Timestamp"]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
