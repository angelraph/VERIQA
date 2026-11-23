import { describe, it, expect, vi } from "vitest";
import { generateSummary } from "../src/insights/summarize";
import { generateTemplateSummary } from "../src/insights/template";
import type { WeeklyStats } from "../src/insights/computeStats";

const stats: WeeklyStats = {
  scoreDelta: 10,
  currentScore: 510,
  revenueThisWeek: 100,
  revenueLastWeek: 80,
  revenueChangePct: 25,
  uniqueCustomersThisWeek: 3,
  uniqueCustomersTrailingAvg: 2,
  daysSinceTopCustomerLastPaid: 5,
  newCustomerCount: 1,
  repeatCustomerRate: 0.5,
};

describe("generateSummary", () => {
  it("returns the template summary and source 'template' when no API key is configured", async () => {
    const result = await generateSummary(stats, { openaiApiKey: undefined });
    expect(result.source).toBe("template");
    expect(result.sentence).toBe(generateTemplateSummary(stats).join(" "));
  });

  it("never calls fetch when no API key is set, the product works with the LLM path fully disabled", async () => {
    const fetchImpl = vi.fn();
    await generateSummary(stats, { openaiApiKey: undefined, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the LLM response when an API key is set and the call succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Great week overall!" } }] }),
    });
    const result = await generateSummary(stats, { openaiApiKey: "sk-test", fetchImpl });
    expect(result.source).toBe("llm");
    expect(result.sentence).toBe("Great week overall!");
  });

  it("only sends the structured stats as input, never tools or function definitions", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    await generateSummary(stats, { openaiApiKey: "sk-test", fetchImpl });

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toBeUndefined();
    expect(body.functions).toBeUndefined();
    expect(JSON.parse(body.messages[1].content)).toEqual(stats);
  });

  it("falls back to the template on a non-2xx LLM response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const result = await generateSummary(stats, { openaiApiKey: "sk-test", fetchImpl });
    expect(result.source).toBe("template");
  });

  it("falls back to the template on a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await generateSummary(stats, { openaiApiKey: "sk-test", fetchImpl });
    expect(result.source).toBe("template");
  });

  it("falls back to the template on a malformed/empty LLM response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    const result = await generateSummary(stats, { openaiApiKey: "sk-test", fetchImpl });
    expect(result.source).toBe("template");
  });
});
