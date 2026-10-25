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
import { patchFiles, shellWrites } from "@/adapters/shared/touches.ts";
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

describe("shellWrites", () => {
  test("redirects, tee, sed -i and moves name the files written", () => {
    expect(shellWrites("cat <<EOF > src/a.ts\nx\nEOF")).toEqual(["src/a.ts"]);
    expect(shellWrites("echo hi >> log.txt")).toEqual(["log.txt"]);
    expect(shellWrites("bun test | tee out.txt")).toEqual(["out.txt"]);
    expect(shellWrites("sed -i '' 's/a/b/' src/b.ts")).toEqual(["src/b.ts"]);
    expect(shellWrites("mv old.ts new.ts")).toEqual(["new.ts"]);
    expect(shellWrites('printf x > "out.txt"')).toEqual(["out.txt"]);
  });

  test("stderr, devices, variables and quoted arrows write nothing", () => {
    expect(shellWrites("bun test 2>&1")).toEqual([]);
    expect(shellWrites("ls > /dev/null")).toEqual([]);
    expect(shellWrites("echo x > $OUT")).toEqual([]);
    expect(shellWrites(`node -e "const f = x => x"`)).toEqual([]);
    expect(shellWrites("git log")).toEqual([]);
    expect(shellWrites("cat x >-3")).toEqual([]);
    expect(shellWrites("python3 - <<'EOF'\nif a >= 0: x => y\nEOF")).toEqual(
      [],
    );
    expect(shellWrites("python3 - <<EOF\nprint(1 > 0)")).toEqual([]);
  });

  test("a shell call that writes a file becomes an edit of it", () => {
    const [act] = claude([
      assistant(1, "m1", [
        toolUse("t1", "Bash", { command: "echo a > src/a.ts" }),
      ]),
      result(2, "t1"),
    ]);
    expect(act?.kind).toBe("edit");
    expect(act?.touches).toContainEqual({ _tag: "File", path: "src/a.ts" });
  });
});
