import { signRequest } from "./auth";

/// Client for the confirmed QIE Pass partner API (qiepass.qie.digital/integration-docs).
/// Only Option 1 (identifier — user already has a QIE Wallet) is used here: a
/// merchant already interacting on-chain necessarily has a wallet, so Option 2
/// (partnerUserRef web-onboarding for brand-new users) does not apply to this flow.

export type QiePassStatus =
  | "pending_kyc"
  | "pending_consent"
  | "consent_given"
  | "consent_rejected"
  | "expired"
  | "failed";

const TERMINAL_STATUSES: readonly QiePassStatus[] = ["consent_given", "consent_rejected", "expired", "failed"];

export function isTerminalStatus(status: QiePassStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface CreateVerificationRequestBody {
  identifier: string; // wallet address, @QIE Pass ID, or name.qie QIE ID
  requestedClaims: string[];
}

export interface VerificationRequestData {
  requestId: string;
  status: QiePassStatus;
  walletAddress?: string;
  requestedClaims: string[];
  expiresAt: string;
  userStatus: "verified" | "not_verified";
  redirectUrl?: string;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface QiePassClientConfig {
  baseUrl: string;
  publicKey: string;
  apiSecret: string;
  fetchImpl?: typeof fetch;
}

export class QiePassApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "QiePassApiError";
  }
}

export class QiePassClient {
  constructor(private readonly config: QiePassClientConfig) {}

  private get fetchFn(): typeof fetch {
    return this.config.fetchImpl ?? fetch;
  }

  private authHeaders(): Record<string, string> {
    return signRequest(this.config.publicKey, this.config.apiSecret);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: { ...this.authHeaders(), ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new QiePassApiError(`QIE Pass API ${res.status}: ${bodyText || res.statusText}`, res.status);
    }
    const envelope = (await res.json()) as ApiEnvelope<T>;
    return envelope.data;
  }

  /** Step 1: create a verification request for a merchant who already has a QIE Wallet. */
  async createVerificationRequest(body: CreateVerificationRequestBody): Promise<VerificationRequestData> {
    return this.request<VerificationRequestData>("/partners/verification-requests", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Step 3: check the current status of a pending request. */
  async getRequestStatus(requestId: string): Promise<VerificationRequestData> {
    return this.request<VerificationRequestData>(`/partners/verification-requests/${requestId}`, {
      method: "GET",
    });
  }

  /** Step 4: claim the verified credential once the request has reached consent_given. */
  async claimAndVerify(requestId: string): Promise<Record<string, unknown>> {
    return this.request(`/vc/partner/claim-and-verify`, {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
  }

  /**
   * Polls a request until it reaches a terminal status (consent_given,
   * consent_rejected, expired, or failed), or until timeoutMs elapses.
   */
  async pollUntilSettled(
    requestId: string,
    opts: { intervalMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void> } = {}
  ): Promise<VerificationRequestData> {
    const intervalMs = opts.intervalMs ?? 5000;
    const timeoutMs = opts.timeoutMs ?? 60 * 60 * 1000;
    const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

    const deadline = Date.now() + timeoutMs;
    let latest = await this.getRequestStatus(requestId);
    while (!isTerminalStatus(latest.status) && Date.now() < deadline) {
      await sleep(intervalMs);
      latest = await this.getRequestStatus(requestId);
    }
    return latest;
  }
}
