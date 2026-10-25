import { describe, expect, test } from "bun:test";
import { makeDecoder } from "@/adapters/claude/decode.ts";
import {
  assistant,
  origin,
  result,
  toolUse,
} from "@/adapters/claude/fixtures.ts";
import { makeCodexDecoder } from "@/adapters/codex/decode.ts";
import { call, meta } from "@/adapters/codex/fixtures.ts";
import { patchFiles } from "@/adapters/shared/touches.ts";
import type { RunEvent } from "@/domain/events.ts";
import { foldAll } from "@/domain/fold.ts";
import { AgentId, ThreadId } from "@/domain/ids.ts";
import { emptyRun } from "@/domain/run.ts";

const main = AgentId("main");

const claude = (lines: unknown[]) => {
  const d = makeDecoder({
    origin,
    agentId: main,
    self: { id: main, parentId: null, name: "main" },
    spawns: () => undefined,
  });
  const events: RunEvent[] = [...lines.flatMap((l) => d.push(l)), ...d.end()];
  return foldAll(emptyRun(ThreadId("s"), origin), events).acts;
};

const codex = (lines: unknown[]) => {
  const d = makeCodexDecoder({ origin, agentId: main });
  const events: RunEvent[] = [...lines.flatMap((l) => d.push(l)), ...d.end()];
  return foldAll(emptyRun(ThreadId("s"), origin), events).acts;
};

describe("claude touches", () => {
  const acts = claude([
    assistant(1, "m1", [
      toolUse("e", "Edit", { file_path: "/w/a.ts" }),
      toolUse("g", "Grep", { pattern: "x", path: "/w/src" }),
      toolUse("b", "Bash", { command: "FOO=1 curl https://api.example.com/x" }),
      toolUse("s", "Skill", { skill: "pdf" }),
    ]),
    result(2, "e"),
  ]);

  test("an edit touches its file", () => {
    expect(acts.find((a) => a.kind === "edit")?.touches).toEqual([
      { _tag: "File", path: "/w/a.ts" },
    ]);
  });

  test("a search touches its folder", () => {
    expect(acts.find((a) => a.kind === "search")?.touches).toEqual([
      { _tag: "Folder", path: "/w/src" },
    ]);
  });

  test("a shell call touches its program and the hosts it reaches", () => {
    expect(acts.find((a) => a.kind === "shell")?.touches).toEqual([
      { _tag: "Command", program: "curl" },
      { _tag: "Host", host: "api.example.com" },
    ]);
  });

  test("a skill call touches the skill", () => {
    expect(acts.find((a) => a.kind === "skill")?.touches).toEqual([
      { _tag: "Skill", name: "pdf" },
    ]);
  });
});

describe("codex touches", () => {
  const patch =
    "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** Add File: src/b.ts\n+z\n*** End Patch";

  test("patchFiles reads every file a patch changes", () => {
    expect(patchFiles(patch)).toEqual([
      { path: "src/a.ts", op: "modify" },
      { path: "src/b.ts", op: "create" },
    ]);
    expect(patchFiles("ls -la")).toEqual([]);
  });

  test("a patch run through a shell is an edit of its files", () => {
    const acts = codex([
      meta(0),
      call(1, "c1", "shell", {
        command: ["bash", "-lc", `apply_patch <<'EOF'\n${patch}\nEOF`],
      }),
    ]);
    expect(acts[0]).toMatchObject({ kind: "edit", edit: { op: "modify" } });
    expect(acts[0]?.touches).toEqual([
      { _tag: "File", path: "src/a.ts" },
      { _tag: "File", path: "src/b.ts" },
    ]);
  });

  test("a plain command touches its program and hosts", () => {
    const acts = codex([
      meta(0),
      call(1, "c1", "shell", { command: ["git", "push", "origin"] }),
    ]);
    expect(acts[0]?.kind).toBe("shell");
    expect(acts[0]?.touches).toEqual([
      { _tag: "Command", program: "git" },
      { _tag: "Host", host: "git" },
    ]);
  });
});
