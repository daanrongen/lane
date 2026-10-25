import { describe, expect, test } from "bun:test";
import {
  actKind,
  failureOf,
  isFailed,
  isOpen,
  needsPerson,
} from "@/domain/act.ts";
import { ActId, AgentId } from "@/domain/ids.ts";

const act = (over: object) => ({
  id: ActId("a"),
  agentId: AgentId("main"),
  kind: "tool" as const,
  label: "x",
  start: 0,
  status: "running" as const,
  touches: [],
  fidelity: "observed" as const,
  ...over,
});

describe("actKind", () => {
  test("names both harnesses' tools by what they do", () => {
    expect(actKind("Edit")).toBe("edit");
    expect(actKind("apply_patch")).toBe("edit");
    expect(actKind("Bash")).toBe("shell");
    expect(actKind("shell")).toBe("shell");
    expect(actKind("WebFetch")).toBe("fetch");
    expect(actKind("ExitPlanMode")).toBe("plan");
  });

  test("an unknown tool is a plain tool", () => {
    expect(actKind("Frobnicate")).toBe("tool");
  });
});

describe("failureOf", () => {
  test.each([
    ["429 Too Many Requests", "rate-limit"],
    ["Permission to use Bash has been denied", "denied"],
    ["Request interrupted by user", "interrupted"],
    ["Prompt is too long", "context"],
    ["getaddrinfo ENOTFOUND example.com", "network"],
    ["ENOENT: no such file", "tool"],
  ])("%s is %s", (reason, cls) => {
    expect(failureOf(reason).class).toBe(cls as never);
    expect(failureOf(reason).reason).toBe(reason);
  });

  test("a missing reason is still a failure", () => {
    expect(failureOf(undefined)).toEqual({ class: "tool", reason: "failed" });
  });
});

describe("act state", () => {
  test("running and awaiting acts are open until they end", () => {
    expect(isOpen(act({}))).toBe(true);
    expect(isOpen(act({ status: "awaiting" }))).toBe(true);
    expect(isOpen(act({ status: "ok", end: 2 }))).toBe(false);
  });

  test("failed and denied acts are failures", () => {
    expect(isFailed(act({ status: "failed" }))).toBe(true);
    expect(isFailed(act({ status: "denied" }))).toBe(true);
    expect(isFailed(act({ status: "ok" }))).toBe(false);
  });

  test("only asks and plans wait for a person", () => {
    expect(needsPerson("ask")).toBe(true);
    expect(needsPerson("plan")).toBe(true);
    expect(needsPerson("shell")).toBe(false);
  });
});
