import { describe, it, expect, vi } from "vitest";
import { QiePassClient, QiePassApiError, isTerminalStatus } from "../src/qiepass/client";

function mockFetchOnce(status: number, body: unknown, statusText = "") {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
}

const baseConfig = { baseUrl: "https://did-stapi.qie.digital/api/v1", publicKey: "pk_test_x", apiSecret: "secret" };

describe("isTerminalStatus", () => {
  it("treats consent_given, consent_rejected, expired, and failed as terminal", () => {
    expect(isTerminalStatus("consent_given")).toBe(true);
    expect(isTerminalStatus("consent_rejected")).toBe(true);
    expect(isTerminalStatus("expired")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
  });

  it("treats pending_kyc and pending_consent as non-terminal", () => {
    expect(isTerminalStatus("pending_kyc")).toBe(false);
    expect(isTerminalStatus("pending_consent")).toBe(false);
  });
});

describe("QiePassClient", () => {
  it("creates a verification request and returns the parsed data", async () => {
    const responseData = {
      requestId: "pvr_123",
      status: "pending_consent",
      walletAddress: "0xabc",
      requestedClaims: ["age_over_18"],
      expiresAt: "2026-04-13T11:00:00.000Z",
      userStatus: "verified",
      createdAt: "2026-04-13T10:00:00.000Z",
    };
    const fetchImpl = mockFetchOnce(200, { success: true, data: responseData });
    const client = new QiePassClient({ ...baseConfig, fetchImpl });

    const result = await client.createVerificationRequest({
      identifier: "0xabc",
      requestedClaims: ["age_over_18"],
    });

    expect(result).toEqual(responseData);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://did-stapi.qie.digital/api/v1/partners/verification-requests");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Public-Key"]).toBe("pk_test_x");
    expect(JSON.parse(init.body)).toEqual({ identifier: "0xabc", requestedClaims: ["age_over_18"] });
  });

  it("throws QiePassApiError on a non-2xx response", async () => {
    const fetchImpl = mockFetchOnce(401, { message: "bad signature" }, "Unauthorized");
    const client = new QiePassClient({ ...baseConfig, fetchImpl });

    await expect(client.getRequestStatus("pvr_123")).rejects.toBeInstanceOf(QiePassApiError);
  });

  it("polls until a terminal status is reached", async () => {
    const pending = { requestId: "pvr_1", status: "pending_consent", requestedClaims: [], expiresAt: "", userStatus: "verified", createdAt: "" };
    const settled = { ...pending, status: "consent_given" };

    let call = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      call += 1;
      const data = call < 3 ? pending : settled;
      return { ok: true, status: 200, statusText: "", text: async () => "", json: async () => ({ success: true, data }) };
    });

    const client = new QiePassClient({ ...baseConfig, fetchImpl });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await client.pollUntilSettled("pvr_1", { sleep, intervalMs: 1 });

    expect(result.status).toBe("consent_given");
    expect(call).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("stops polling at the timeout even if never settled", async () => {
    const pending = { requestId: "pvr_1", status: "pending_kyc", requestedClaims: [], expiresAt: "", userStatus: "not_verified", createdAt: "" };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: "", text: async () => "", json: async () => ({ success: true, data: pending }) });

    let now = 0;
    const client = new QiePassClient({ ...baseConfig, fetchImpl });
    const sleep = vi.fn().mockImplementation(async () => {
      now += 10;
    });
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const result = await client.pollUntilSettled("pvr_1", { sleep, intervalMs: 10, timeoutMs: 25 });
      expect(result.status).toBe("pending_kyc");
    } finally {
      Date.now = realNow;
    }
  });
});
