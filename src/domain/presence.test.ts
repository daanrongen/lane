import { describe, expect, test } from "bun:test";
import { ThreadId } from "@/domain/ids.ts";
import { type Found, find, presence } from "@/domain/presence.ts";
import type { Thread } from "@/domain/thread.ts";

const thread = (
  harness: string,
  id: string,
  cwd: string,
  status: Thread["status"],
  updatedAt = 1,
): Thread => ({
  harness,
  id: ThreadId(id),
  cwd,
  status,
  updatedAt,
});
const proc = (harness: string, pid: number, cwd?: string): Found => ({
  harness,
  pid,
  cwd,
  command: harness,
});

describe("find", () => {
  const cmds = (...c: string[]) =>
    find(c.map((command, pid) => ({ pid, command }))).map((p) => p.harness);

  test("recognises each harness by its program", () => {
    expect(
      cmds(
        "claude",
        "/Users/x/.local/bin/claude --resume",
        "codex exec fix",
        "node /x/bin/codex.js",
        "ollama run gemma",
      ),
    ).toEqual(["claude", "claude", "codex", "codex", "ollama"]);
  });

  test("ignores helpers, servers and lookalikes", () => {
    expect(
      cmds(
        "claude mcp serve",
        "codex mcp-server",
        "ollama serve",
        "vim claude.md",
        "/Applications/Claude.app/Contents/MacOS/Claude",
        "grep claude",
      ),
    ).toEqual([]);
  });
});

describe("presence", () => {
  test("a process brings the newest quiet thread in its directory to life", () => {
    const t = [
      thread("codex", "old", "/w", "past", 1),
      thread("codex", "new", "/w", "past", 9),
      thread("codex", "elsewhere", "/x", "past", 99),
    ];
    const out = presence(t, [proc("codex", 1, "/w")]);
    expect(out.threads.map((x) => x.status)).toEqual(["past", "idle", "past"]);
    expect(out.orphans).toEqual([]);
  });

  test("two processes bring two threads to life, a third has none", () => {
    const t = [
      thread("codex", "a", "/w", "past", 1),
      thread("codex", "b", "/w", "past", 2),
    ];
    const out = presence(t, [
      proc("codex", 1, "/w"),
      proc("codex", 2, "/w"),
      proc("codex", 3, "/w"),
    ]);
    expect(out.threads.map((x) => x.status)).toEqual(["idle", "idle"]);
    expect(out.orphans.map((p) => p.pid)).toEqual([3]);
  });

  test("a thread already live explains its process", () => {
    const t = [
      thread("codex", "a", "/w", "busy"),
      thread("codex", "b", "/w", "past", 5),
    ];
    const out = presence(t, [proc("codex", 1, "/w")]);
    expect(out.threads.map((x) => x.status)).toEqual(["busy", "past"]);
    expect(out.orphans).toEqual([]);
  });

  test("a process with no known directory stays on its own", () => {
    expect(presence([], [proc("ollama", 4)]).orphans.map((p) => p.pid)).toEqual(
      [4],
    );
  });
});
