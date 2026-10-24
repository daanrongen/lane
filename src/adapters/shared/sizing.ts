import { arr, rec } from "@/adapters/shared/json.ts";

// Roughly four characters per token.
export const tokensOf = (chars: number) => Math.ceil(chars / 4);

export const sizeOf = (v: unknown): number =>
  typeof v === "string"
    ? v.length
    : Array.isArray(v)
      ? v.reduce(
          (n: number, b) =>
            n + (typeof b === "string" ? b.length : sizeOf(rec(b)?.text ?? 0)),
          0,
        )
      : typeof v === "object" && v !== null
        ? JSON.stringify(v).length
        : 0;

// A screenshot costs about this many tokens, whatever its bytes.
export const IMAGE_TOKENS = 3_000;

export const imagesIn = (v: unknown) =>
  arr(v).filter((b) => rec(b)?.type === "image").length;
