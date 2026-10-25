import { describe, expect, test } from "bun:test";
import type { RunEvent } from "@/domain/events.ts";
import { type Entry, floor } from "@/domain/floor.ts";
import { foldAll } from "@/domain/fold.ts";
import { ActId, AgentId, SpanId, ThreadId } from "@/domain/ids.ts";
import { file } from "@/domain/ref.ts";
import { emptyRun } from "@/domain/run.ts";
import type { Thread } from "@/domain/thread.ts";
import { vitals } from "@/domain/vitals.ts";

const main = AgentId("main");
const START = 1_000_000;

const root: RunEvent = {
  _tag: "AgentSpawned",
  agent: { id: main, parentId: null, name: "main" },
  at: 0,
};

const edit = (id: string, path: string, start: number): RunEvent[] => [
  {
    _tag: "SpanOpened",
    span: {
      _tag: "ToolCall",
      id: SpanId(id),
      agentId: main,
      label: path,
      tool: "Edit",
      failed: false,
      start,
    },
  },
  { _tag: "ActUpdated", id: ActId(id), touched: [file(path)] },
  { _tag: "SpanClosed", spanId: SpanId(id), at: start + 1 },
];

const entry = (
  harness: string,
  id: string,
  cwd: string,
  events: RunEvent[],
  status: Thread["status"] = "busy",
): Entry => ({
  thread: {
    harness,
    id: ThreadId(id),
    cwd,
    status,
    updatedAt: START,
    name: id,
  },
  run: foldAll(emptyRun(ThreadId(id), START), [root, ...events]),
  tasks: [],
  workspace: { root: cwd, branch: "main" },
});

const at = START + 30_000;

describe("floor", () => {
  const api = entry("claude", "api", "/w/api", [
    ...edit("e1", "src/a.ts", 5),
    {
      _tag: "SpanOpened",
      span: {
        _tag: "ToolCall",
        id: SpanId("q"),
        agentId: main,
        label: "which db?",
        tool: "AskUserQuestion",
        failed: false,
        start: 20,
      },
    },
  ]);
  const web = entry(
    "codex",
    "web",
    "/w/web",
    [...edit("e2", "/w/web/x.ts", 6)],
    "past",
  );
  const f = floor(at, [api, web], [], []);

  test("every agent is a view with its state and what it is doing", () => {
    const a = f.agents.find((v) => v.name === "api");
    expect(a).toMatchObject({
      state: "needs-you",
      harness: "claude",
      workspace: "/w/api",
    });
    expect(a?.now?.label).toBe("which db?");
    expect(f.agents.find((v) => v.name === "web")?.state).toBe("done");
  });

  test("attention lists what needs a person with an epoch time", () => {
    expect(f.attention).toMatchObject([
      { reason: "question", label: "which db?", since: START + 20_000 },
    ]);
    expect(f.totals.states["needs-you"]).toBe(1);
    expect(f.totals.states.done).toBe(1);
  });

  test("workspaces carry their agents and the files they touched", () => {
    const w = f.workspaces.find((x) => x.root === "/w/api");
    expect(w?.agents).toHaveLength(1);
    expect(w?.branch).toBe("main");
    expect(JSON.stringify(w?.tree)).toContain("/w/api/src/a.ts");
  });

  test("workspaces are ordered by their latest activity", () => {
    expect(f.workspaces.map((w) => w.root)).toEqual(["/w/api", "/w/web"]);
  });

  test("two threads editing one file collide, one thread does not", () => {
    const other = entry(
      "codex",
      "other",
      "/w/api",
      edit("e3", "/w/api/src/a.ts", 7),
    );
    const hit = floor(at, [api, other]);
    expect(hit.insights.find((i) => i.kind === "collision")?.label).toBe(
      "/w/api/src/a.ts",
    );
    expect(hit.agents.every((v) => v.insights.includes("collision"))).toBe(
      true,
    );
    expect(hit.workspaces[0]?.tree.collided).toBe(true);
    expect(f.insights.some((i) => i.kind === "collision")).toBe(false);
  });

  test("an edit long ago is not a collision", () => {
    const other = entry(
      "codex",
      "other",
      "/w/api",
      edit("e3", "/w/api/src/a.ts", 7),
    );
    expect(
      floor(at + 3_600_000, [api, other]).insights.some(
        (i) => i.kind === "collision",
      ),
    ).toBe(false);
  });

  test("a process with no transcript shows as an idle agent, and runtimes know their users", () => {
    const g = floor(
      at,
      [],
      [
        {
          harness: "ollama",
          pid: 7,
          command: "ollama run gemma",
          workspace: { root: "/w/lab" },
          startedAt: at,
        },
      ],
      [
        {
          id: "local",
          kind: "ollama",
          name: "ollama",
          models: [{ name: "gemma:2b", bytes: 1 }],
        },
      ],
    );
    expect(g.agents[0]).toMatchObject({
      origin: "process",
      state: "idle",
      name: "ollama",
      harness: "ollama",
    });
    expect(g.runtimes[0]?.usedBy).toEqual([]);
  });

  test("an empty machine is an empty floor", () => {
    expect(floor(at, [])).toMatchObject({
      agents: [],
      workspaces: [],
      attention: [],
    });
  });
});

describe("vitals", () => {
  test("model, fill, modes and limits come from turns, modes and readings", () => {
    const run = foldAll(emptyRun(ThreadId("t"), 0), [
      {
        _tag: "TurnReported",
        turn: {
          agentId: main,
          at: 1,
          model: "gpt-5",
          window: 1000,
          usage: { input: 100, output: 5, cacheRead: 0, cacheWrite: 0 },
        },
      },
      {
        _tag: "ModeChanged",
        change: { agentId: main, at: 1, kind: "approval", value: "never" },
      },
      {
        _tag: "SignalReported",
        reading: {
          agentId: main,
          at: 2,
          signal: { _tag: "Mode", kind: "approval", value: "on-request" },
        },
      },
      {
        _tag: "SignalReported",
        reading: {
          agentId: main,
          at: 2,
          signal: { _tag: "Limit", window: "5h", used: 0.5 },
        },
      },
      {
        _tag: "SignalReported",
        reading: {
          agentId: main,
          at: 3,
          signal: { _tag: "Limit", window: "5h", used: 0.95 },
        },
      },
    ]);
    const v = vitals(run, main);
    expect(v.model).toBe("gpt-5");
    expect(v.provider).toBe("openai");
    expect(v.fill).toEqual({ used: 100, window: 1000, ratio: 0.1 });
    expect(v.modes).toEqual({ approval: "on-request" });
    expect(v.limits).toEqual([{ _tag: "Limit", window: "5h", used: 0.95 }]);
    expect(v.usage.output).toBe(5);
  });

  test("an agent with no turns has no fill", () => {
    expect(vitals(emptyRun(ThreadId("t"), 0), main).fill).toBeUndefined();
  });
});
