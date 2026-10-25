import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  RuntimesOllama,
  readRuntime,
} from "@/adapters/ollama/RuntimesOllama.ts";
import { Runtimes } from "@/ports/Runtimes.ts";

const body = {
  models: [
    {
      name: "gemma:2b",
      size: 3_000,
      size_vram: 2_000,
      expires_at: "2026-01-01T00:05:00Z",
    },
    { size: 1 },
  ],
};

const list = (layer: ReturnType<typeof RuntimesOllama>) =>
  Effect.runPromise(Runtimes.use((r) => r.list).pipe(Effect.provide(layer)));

describe("readRuntime", () => {
  test("loaded models carry their size, memory and unload time", () => {
    expect(readRuntime(body).models).toEqual([
      {
        name: "gemma:2b",
        bytes: 3_000,
        vram: 2_000,
        expiresAt: Date.parse("2026-01-01T00:05:00Z"),
      },
    ]);
  });
});

describe("RuntimesOllama", () => {
  test("a server that answers is a runtime", async () => {
    const get = (async () => Response.json(body)) as unknown as typeof fetch;
    expect((await list(RuntimesOllama(get)))[0]?.models).toHaveLength(1);
  });

  test("a server that does not answer is no runtime", async () => {
    const get = (async () => {
      throw new Error("refused");
    }) as unknown as typeof fetch;
    expect(await list(RuntimesOllama(get))).toEqual([]);
  });

  test("it asks again only after a few seconds", async () => {
    let asked = 0;
    let t = 0;
    const get = (async () => {
      asked++;
      return Response.json(body);
    }) as unknown as typeof fetch;
    const layer = RuntimesOllama(get, "h", () => t);
    await list(layer);
    t = 1_000;
    await list(layer);
    t = 5_000;
    await list(layer);
    expect(asked).toBe(2);
  });
});
