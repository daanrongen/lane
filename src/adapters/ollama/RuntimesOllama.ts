import { Effect, Layer } from "effect";
import { arr, num, rec, str } from "@/adapters/shared/json.ts";
import type { Runtime } from "@/domain/runtime.ts";
import { Runtimes } from "@/ports/Runtimes.ts";

const HOST = process.env.OLLAMA_HOST ?? "127.0.0.1:11434";
const FRESH = 3_000;

// Models the server has loaded, from `/api/ps`; unreachable means no runtime.
export const readRuntime = (body: unknown): Runtime => ({
  id: "ollama",
  kind: "ollama",
  name: "Ollama",
  models: arr(rec(body)?.models).flatMap((m) => {
    const model = rec(m);
    const name = str(model?.name);
    if (!name) return [];
    const expires = Date.parse(str(model?.expires_at) ?? "");
    return [
      {
        name,
        bytes: num(model?.size),
        vram: num(model?.size_vram) || undefined,
        expiresAt: Number.isNaN(expires) ? undefined : expires,
      },
    ];
  }),
});

export const RuntimesOllama = (
  get: typeof fetch = fetch,
  host = HOST,
  now: () => number = Date.now,
) => {
  let cached: { at: number; found: readonly Runtime[] } | undefined;
  return Layer.succeed(Runtimes, {
    list: Effect.promise(async () => {
      if (cached && now() - cached.at < FRESH) return cached.found;
      const found = await get(`http://${host}/api/ps`, {
        signal: AbortSignal.timeout(1_000),
      })
        .then((r) => r.json())
        .then((body) => [readRuntime(body)])
        .catch((): readonly Runtime[] => []);
      cached = { at: now(), found };
      return found;
    }),
  });
};
