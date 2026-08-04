import type { WeeklyStats } from "./computeStats";
import { generateTemplateSummary } from "./template";

export interface SummaryResult {
  sentence: string;
  source: "template" | "llm";
}

export interface GenerateSummaryOptions {
  openaiApiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Turns already-computed weekly stats into plain English. The LLM call, when
 * enabled, receives ONLY the structured stats object below as JSON — no tool
 * use, no function calling, no wallet/signer access, no memory across runs.
 * Ship template-only: this function must behave correctly with no API key set
 * (the default), which is the concrete defense against a "thin AI wrapper"
 * reading — the product is fully demoable with the LLM path disabled.
 */
export async function generateSummary(stats: WeeklyStats, options: GenerateSummaryOptions = {}): Promise<SummaryResult> {
  const templateSentence = generateTemplateSummary(stats).join(" ");
  const apiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { sentence: templateSentence, source: "template" };
  }

  const fetchFn = options.fetchImpl ?? fetch;
  try {
    const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the given business stats as 2-4 short, plain-English sentences for a small-business dashboard. " +
              "Only use the numbers provided — do not invent facts, advice, or numbers not present in the input.",
          },
          { role: "user", content: JSON.stringify(stats) },
        ],
      }),
    });

    if (!res.ok) {
      return { sentence: templateSentence, source: "template" };
    }

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { sentence: templateSentence, source: "template" };
    }
    return { sentence: text, source: "llm" };
  } catch {
    // Network error, timeout, malformed response — always fall back cleanly.
    return { sentence: templateSentence, source: "template" };
  }
}
