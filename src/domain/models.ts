// Who served a model, as far as its name shows: Claude's are Anthropic's, `name:tag` is Ollama's.
export const providerOf = (model: string | undefined) => {
  if (!model) return undefined;
  if (model.startsWith("claude-")) return "anthropic";
  if (model.includes(":")) return "ollama";
  return /^(gpt|o\d|codex)/.test(model) ? "openai" : undefined;
};

import type { Turn } from "@/domain/run.ts";

// A stretch of a lane during which one model answered.
export interface ModelSpan {
  readonly model: string;
  readonly provider?: string;
  readonly start: number;
  readonly end: number;
  readonly turns: number;
  readonly output: number;
}

const providerFor = (t: Turn) => t.provider ?? providerOf(t.model);

// Consecutive turns by the same model make one span; the first starts at `from`, the last ends at `to`.
export const modelSpans = (
  turns: readonly Turn[],
  from: number,
  to: number,
): ModelSpan[] => {
  const spans: ModelSpan[] = [];
  for (const t of [...turns].sort((a, b) => a.at - b.at)) {
    if (!t.model) continue;
    const last = spans.at(-1);
    if (last?.model === t.model) {
      spans[spans.length - 1] = {
        ...last,
        turns: last.turns + 1,
        output: last.output + t.usage.output,
      };
    } else {
      spans.push({
        model: t.model,
        provider: providerFor(t),
        start: last ? t.at : from,
        end: to,
        turns: 1,
        output: t.usage.output,
      });
    }
  }
  return spans.map((s, i) => ({ ...s, end: spans[i + 1]?.start ?? to }));
};

export interface ModelUse {
  readonly model: string;
  readonly provider?: string;
  readonly turns: number;
  readonly output: number;
  readonly first: number;
  readonly last: number;
}

// Which models answered anywhere in the run, busiest first.
export const modelsUsed = (turns: readonly Turn[]): ModelUse[] => {
  const byModel = new Map<string, ModelUse>();
  for (const t of turns) {
    if (!t.model) continue;
    const prev = byModel.get(t.model);
    byModel.set(t.model, {
      model: t.model,
      provider: providerFor(t),
      turns: (prev?.turns ?? 0) + 1,
      output: (prev?.output ?? 0) + t.usage.output,
      first: Math.min(prev?.first ?? t.at, t.at),
      last: Math.max(prev?.last ?? t.at, t.at),
    });
  }
  return [...byModel.values()].sort((a, b) => b.turns - a.turns);
};
