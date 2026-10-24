export type Json = Record<string, unknown>;

export const parseJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

export const rec = (v: unknown): Json | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Json)
    : undefined;
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown) => (typeof v === "string" ? v : undefined);
export const num = (v: unknown) => (typeof v === "number" ? v : 0);
