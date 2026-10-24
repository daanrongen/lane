import type { ModeChange } from "@/domain/run.ts";

// A stretch during which one mode held, with everything else that held then.
export interface PostureSpan {
  readonly kind: ModeChange["kind"];
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly alongside: readonly (readonly [string, string])[];
}

// Claude says how freely it may act (permission); Codex says when it must ask (approval).
const PRIMARY: readonly ModeChange["kind"][] = ["permission", "approval"];

// The primary mode over time, up to `end`. Other modes ride along as context.
export const posture = (
  modes: readonly ModeChange[],
  end: number,
): PostureSpan[] => {
  const kind = PRIMARY.find((k) => modes.some((m) => m.kind === k));
  if (!kind) return [];
  const sorted = [...modes].sort((a, b) => a.at - b.at);
  const primary = sorted.filter((m) => m.kind === kind);
  return primary.map((m, i) => {
    const until = primary[i + 1]?.at ?? end;
    const held = new Map<string, string>();
    for (const o of sorted)
      if (o.kind !== kind && o.at <= m.at) held.set(o.kind, o.value);
    return {
      kind,
      value: m.value,
      start: m.at,
      end: until,
      alongside: [...held],
    };
  });
};
