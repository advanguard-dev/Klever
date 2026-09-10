import type { Note } from "@/types";

/** Approximate tokens from text: 1 token ≈ 4 characters. */
export const CHARS_PER_TOKEN = 4;

export type InputRate = {
  /** USD per 1 million input tokens. */
  usdPerMillion: number;
  /** USD per 1 million output tokens. Output is billed several times input. */
  outputUsdPerMillion: number;
  label: string;
};

/**
 * Token rates (USD / 1M tokens) for known chat models.
 * Page-size estimates use the input rate; completed calls bill both sides
 * from the provider's reported usage via {@link usageCostUsd}.
 */
export const INPUT_RATES: { test: RegExp; rate: InputRate }[] = [
  { test: /moonshine|ollama|^llama|localhost|127\.0\.0\.1|:11434/i, rate: { usdPerMillion: 0, outputUsdPerMillion: 0, label: "local" } },

  { test: /gpt-5-nano/i, rate: { usdPerMillion: 0.05, outputUsdPerMillion: 0.4, label: "OpenAI" } },
  { test: /gpt-5-mini/i, rate: { usdPerMillion: 0.25, outputUsdPerMillion: 2, label: "OpenAI" } },
  { test: /gpt-5/i, rate: { usdPerMillion: 1.25, outputUsdPerMillion: 10, label: "OpenAI" } },
  { test: /gpt-4\.1-nano/i, rate: { usdPerMillion: 0.1, outputUsdPerMillion: 0.4, label: "OpenAI" } },
  { test: /gpt-4\.1-mini/i, rate: { usdPerMillion: 0.4, outputUsdPerMillion: 1.6, label: "OpenAI" } },
  { test: /gpt-4\.1/i, rate: { usdPerMillion: 2, outputUsdPerMillion: 8, label: "OpenAI" } },
  { test: /gpt-4o-mini/i, rate: { usdPerMillion: 0.15, outputUsdPerMillion: 0.6, label: "OpenAI" } },
  { test: /gpt-4o/i, rate: { usdPerMillion: 2.5, outputUsdPerMillion: 10, label: "OpenAI" } },
  { test: /o4-mini/i, rate: { usdPerMillion: 1.1, outputUsdPerMillion: 4.4, label: "OpenAI" } },
  { test: /o3-mini/i, rate: { usdPerMillion: 1.1, outputUsdPerMillion: 4.4, label: "OpenAI" } },
  { test: /^o3(?!-)/i, rate: { usdPerMillion: 10, outputUsdPerMillion: 40, label: "OpenAI" } },

  { test: /claude-opus-4|claude-4-opus|claude-3-opus/i, rate: { usdPerMillion: 15, outputUsdPerMillion: 75, label: "Anthropic" } },
  { test: /claude-sonnet-4|claude-4-sonnet|claude-3[.-]5-sonnet|claude-3[.-]7-sonnet/i, rate: { usdPerMillion: 3, outputUsdPerMillion: 15, label: "Anthropic" } },
  { test: /claude-haiku-4|claude-4-haiku|claude-3[.-]5-haiku/i, rate: { usdPerMillion: 0.8, outputUsdPerMillion: 4, label: "Anthropic" } },
  { test: /claude-3-haiku/i, rate: { usdPerMillion: 0.25, outputUsdPerMillion: 1.25, label: "Anthropic" } },

  { test: /gemini-3\.6-flash|gemini-3-flash|gemini-2\.5-flash|gemini-2\.0-flash/i, rate: { usdPerMillion: 0.15, outputUsdPerMillion: 0.6, label: "Google" } },
  { test: /gemini-2\.5-pro|gemini-3\.5-pro|gemini-1\.5-pro|gemini-pro/i, rate: { usdPerMillion: 1.25, outputUsdPerMillion: 10, label: "Google" } },
  { test: /gemini-1\.5-flash|gemini-flash/i, rate: { usdPerMillion: 0.075, outputUsdPerMillion: 0.3, label: "Google" } },
];

export function estimateTokens(text: string): number {
  const chars = text.length;
  if (chars === 0) return 0;
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
}

function serializeProps(props: Record<string, unknown>): string {
  const lines = Object.entries(props).map(([key, value]) => {
    let printed: string;
    if (value == null) printed = "";
    else if (typeof value === "string") printed = value;
    else {
      try {
        printed = JSON.stringify(value);
      } catch {
        printed = String(value);
      }
    }
    return `${key}: ${printed}`;
  });
  return lines.join("\n");
}

/** Title + body + properties — the page you’d send as context. */
export function pageContextText(note: Note, liveBody?: string): string {
  const body = (liveBody?.trim() ? liveBody : note.body) ?? "";
  const props = serializeProps(note.props ?? {});
  return [note.title ?? "", body, props].filter((s) => s.trim()).join("\n\n");
}

export function lookupInputRate(model: string, endpoint = ""): InputRate | null {
  const haystack = `${model}\n${endpoint}`;
  for (const row of INPUT_RATES) {
    if (row.test.test(haystack)) return row.rate;
  }
  return null;
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.0001) return `$${amount.toExponential(1)}`;
  if (amount < 0.01) return `$${amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  if (amount < 1) return `$${amount.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${amount.toFixed(2)}`;
}

export type PageAiEstimate = {
  tokens: number;
  chars: number;
  model: string;
  rate: InputRate | null;
  costUsd: number | null;
};

export function estimatePageAiCost(
  note: Note,
  model: string,
  endpoint: string,
  liveBody?: string,
): PageAiEstimate {
  const text = pageContextText(note, liveBody);
  const tokens = estimateTokens(text);
  const rate = lookupInputRate(model, endpoint);
  const costUsd = rate ? (tokens / 1_000_000) * rate.usdPerMillion : null;
  return {
    tokens,
    chars: text.length,
    model: model.trim() || "unset",
    rate,
    costUsd,
  };
}

/** Token counts as reported by the provider for one completed call. */
export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Read the OpenAI-compatible `usage` block off a chat completion response. */
export function readUsage(raw: unknown): AiUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const u = (raw as { usage?: Record<string, unknown> }).usage;
  if (!u) return null;
  const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const output = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  if (input <= 0 && output <= 0) return null;
  return { inputTokens: Math.max(0, input), outputTokens: Math.max(0, output) };
}

/**
 * Billed cost of one completed call. Output tokens dominate for tools that
 * echo text back, so both sides are priced separately.
 */
export function usageCostUsd(usage: AiUsage, model: string, endpoint = ""): number | null {
  const rate = lookupInputRate(model, endpoint);
  if (!rate) return null;
  return (
    (usage.inputTokens / 1_000_000) * rate.usdPerMillion +
    (usage.outputTokens / 1_000_000) * rate.outputUsdPerMillion
  );
}

/** Running total of real AI spend, keyed by tool, for the current session. */
export type AiSpend = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** True when any recorded call used a model with no known rate. */
  partial: boolean;
};

const emptySpend = (): AiSpend => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  partial: false,
});

const spendByTool = new Map<string, AiSpend>();
const spendListeners = new Set<() => void>();

/** Record one completed call. Called from the AI transport, not from UI. */
export function recordAiSpend(tool: string, usage: AiUsage, model: string, endpoint = "") {
  const entry = spendByTool.get(tool) ?? emptySpend();
  const cost = usageCostUsd(usage, model, endpoint);
  entry.calls += 1;
  entry.inputTokens += usage.inputTokens;
  entry.outputTokens += usage.outputTokens;
  if (cost == null) entry.partial = true;
  else entry.costUsd += cost;
  spendByTool.set(tool, entry);
  for (const fn of spendListeners) fn();
}

export function aiSpend(tool?: string): AiSpend {
  if (tool) return { ...(spendByTool.get(tool) ?? emptySpend()) };
  const total = emptySpend();
  for (const entry of spendByTool.values()) {
    total.calls += entry.calls;
    total.inputTokens += entry.inputTokens;
    total.outputTokens += entry.outputTokens;
    total.costUsd += entry.costUsd;
    total.partial = total.partial || entry.partial;
  }
  return total;
}

/** Subscribe to spend changes. Returns an unsubscribe function. */
export function onAiSpend(fn: () => void): () => void {
  spendListeners.add(fn);
  return () => spendListeners.delete(fn);
}
