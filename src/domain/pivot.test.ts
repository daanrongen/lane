import { describe, expect, test } from "bun:test";
import type { FeedItem, Floor } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { refsOf, touching } from "@/domain/pivot.ts";
import { file, folder, host, mcp } from "@/domain/ref.ts";

const a = AgentRef("claude", "t", "main");
const b = AgentRef("codex", "u", "main");
const item = (agent: typeof a, label: string, touches: FeedItem["touches"]) =>
  ({ at: 0, agent, kind: "tool", label, status: "ok", touches }) as FeedItem;

const floor = {
  agents: [
    { ref: a, model: "opus" },
    { ref: b, model: "gpt-5" },
  ],
  feed: [
    item(a, "edit", [file("/w/ui/Button.tsx")]),
    item(b, "edit", [file("/w/ui/Button.tsx")]),
    item(a, "list", [mcp("linear", "list"), host("api.linear.app")]),
    item(b, "read", [file("/w/api/x.ts")]),
  ],
} as unknown as Floor;

describe("touching", () => {
  test("a file shows every agent that touched it", () => {
    const hit = touching(floor, file("/w/ui/Button.tsx"));
    expect(hit.map((i) => i.agent)).toEqual([a, b]);
  });

  test("a folder covers the files inside it, not its neighbours", () => {
    expect(touching(floor, folder("/w/ui")).length).toBe(2);
    expect(touching(floor, folder("/w/u")).length).toBe(0);
  });

  test("an MCP server matches whichever tool was called", () => {
    expect(touching(floor, mcp("linear")).map((i) => i.label)).toEqual([
      "list",
    ]);
  });

  test("a model shows what its agents did", () => {
    const hit = touching(floor, { _tag: "Model", id: "gpt-5" });
    expect(hit.map((i) => i.agent)).toEqual([b, b]);
  });
});

describe("refsOf", () => {
  test("lists what was touched and the models, most used first", () => {
    const refs = refsOf(floor);
    expect(refs[0]?.ref).toEqual(file("/w/ui/Button.tsx"));
    expect(refs[0]?.count).toBe(2);
    expect(refs.some((r) => r.ref._tag === "Model")).toBe(true);
    expect(refs.some((r) => r.ref._tag === "Host")).toBe(true);
  });
});
