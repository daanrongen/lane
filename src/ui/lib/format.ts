export const duration = (seconds: number) => {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600)
    return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
};

export const dollars = (usd: number) =>
  usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;

const fixed = (n: number) => n.toFixed(1).replace(/\.0$/, "");

export const tokens = (n: number) =>
  n < 1_000
    ? String(n)
    : n < 1_000_000
      ? `${fixed(n / 1_000)}k`
      : `${fixed(n / 1_000_000)}M`;

export const modelName = (model: string) => model.replace(/^claude-/, "");

export const plural = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

// Sub-second precision for single spans, where whole seconds hide the detail.
export const exact = (seconds: number) =>
  seconds < 1
    ? `${Math.round(seconds * 1000)}ms`
    : seconds < 10
      ? `${seconds.toFixed(1)}s`
      : duration(seconds);

export const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%";

export const bytes = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1).replace(/\.0$/, "")} GB`
    : n >= 1e6
      ? `${Math.round(n / 1e6)} MB`
      : `${Math.round(n / 1e3)} KB`;

export const clip = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

export const ago = (ms: number) => {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};
