import { describe, expect, test } from "bun:test";
import { AgentId } from "@/domain/ids.ts";
import { modelSpans, modelsUsed } from "@/domain/models.ts";
import { posture } from "@/domain/posture.ts";
import type { ModeChange, SkillUse, Turn } from "@/domain/run.ts";
import { skillKey, skillsUsed } from "@/domain/skills.ts";

const a = AgentId("a");
const turn = (at: number, model: string, output = 10): Turn => ({
  agentId: a,
  at,
  model,
  usage: { input: 0, output, cacheRead: 0, cacheWrite: 0 },
});

describe("modelSpans", () => {
  test("a model change starts a new span at its first turn", () => {
    const spans = modelSpans(
      [
        turn(2, "claude-sonnet-5-5"),
        turn(4, "claude-sonnet-5-5"),
        turn(9, "gpt-oss:20b"),
      ],
      0,
      12,
    );
    expect(
      spans.map((s) => [s.model, s.provider, s.start, s.end, s.turns]),
    ).toEqual([
      ["claude-sonnet-5-5", "anthropic", 0, 9, 2],
      ["gpt-oss:20b", "ollama", 9, 12, 1],
    ]);
  });

  test("turns without a model are skipped", () => {
    expect(modelSpans([{ ...turn(1, "x"), model: undefined }], 0, 5)).toEqual(
      [],
    );
  });
});

describe("modelsUsed", () => {
  test("counts turns and output per model, busiest first", () => {
    const used = modelsUsed([
      turn(1, "m1"),
      turn(2, "m2", 5),
      turn(3, "m2", 7),
    ]);
    expect(
      used.map((u) => [u.model, u.turns, u.output, u.first, u.last]),
    ).toEqual([
      ["m2", 2, 12, 2, 3],
      ["m1", 1, 10, 1, 1],
    ]);
  });
});

describe("skillsUsed", () => {
  test("groups uses by name", () => {
    const use = (name: string, at: number, via: SkillUse["via"]): SkillUse => ({
      agentId: a,
      at,
      name,
      via,
    });
    expect(
      skillsUsed([
        use("x", 5, "tool"),
        use("y", 1, "mention"),
        use("x", 9, "mention"),
      ]),
    ).toEqual([
      { name: "x", count: 2, first: 5, last: 9, via: ["tool", "mention"] },
      { name: "y", count: 1, first: 1, last: 1, via: ["mention"] },
    ]);
    expect(skillKey("basecamp:basecamp")).toBe("basecamp");
  });
});

describe("posture", () => {
  const change = (
    at: number,
    kind: ModeChange["kind"],
    value: string,
  ): ModeChange => ({ agentId: a, at, kind, value });

  test("the permission mode holds until it changes, with other modes alongside", () => {
    const spans = posture(
      [
        change(0, "permission", "plan"),
        change(1, "effort", "high"),
        change(10, "permission", "auto"),
      ],
      30,
    );
    expect(spans.map((s) => [s.value, s.start, s.end])).toEqual([
      ["plan", 0, 10],
      ["auto", 10, 30],
    ]);
    expect(spans[1]?.alongside).toEqual([["effort", "high"]]);
  });

  test("codex's approval policy stands in when there is no permission mode", () => {
    expect(posture([change(0, "approval", "on-request")], 5)[0]?.kind).toBe(
      "approval",
    );
    expect(posture([], 5)).toEqual([]);
  });
});
