import { describe, expect, test } from "bun:test";
import type { AgentState } from "@/domain/agent.ts";
import { alerts } from "@/domain/alerts.ts";
import type { AgentView, Floor } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";

const ref = AgentRef("claude", "t", "main");
const floor = (state: AgentState, depth = 0, attention = false) =>
  ({
    agents: [{ ref, name: "api", state, depth } as AgentView],
    attention: attention ? [{ agent: ref, label: "rm -rf dist" }] : [],
  }) as unknown as Floor;

describe("alerts", () => {
  test("the first floor says nothing", () => {
    expect(alerts(undefined, floor("needs-you"))).toEqual([]);
  });

  test("entering a state worth leaving for is one alert, with why", () => {
    expect(alerts(floor("working"), floor("needs-you", 0, true))).toEqual([
      { agent: ref, title: "api needs you", body: "rm -rf dist" },
    ]);
    expect(alerts(floor("needs-you"), floor("needs-you"))).toEqual([]);
  });

  test("working and idle are not worth it, finishing is only after work", () => {
    expect(alerts(floor("idle"), floor("working"))).toEqual([]);
    expect(alerts(floor("idle"), floor("done"))).toEqual([]);
    expect(alerts(floor("working"), floor("done"))).toHaveLength(1);
  });

  test("sub-agents stay quiet", () => {
    expect(alerts(floor("working", 1), floor("failed", 1))).toEqual([]);
  });
});
