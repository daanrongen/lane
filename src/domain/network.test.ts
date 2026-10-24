import { describe, expect, test } from "bun:test";
import { AgentId } from "@/domain/ids.ts";
import { hostOf, hosts, targetsOfCommand } from "@/domain/network.ts";
import type { Request } from "@/domain/run.ts";

describe("targetsOfCommand", () => {
  test("a url names its host", () => {
    expect(
      targetsOfCommand('curl -s "https://api.linear.app/graphql?x=1" | jq .'),
    ).toEqual([
      { host: "api.linear.app", label: "https://api.linear.app/graphql?x=1" },
    ]);
  });

  test("a networked program stands in when no url is visible", () => {
    expect(targetsOfCommand("cd x && git push origin main")).toEqual([
      { host: "git", label: "git push origin main" },
    ]);
    expect(targetsOfCommand("FOO=1 sudo brew install jq")[0]?.host).toBe(
      "brew",
    );
  });

  test("local commands and local-only subcommands are not network", () => {
    expect(targetsOfCommand("ls -la && git status && bun test")).toEqual([]);
  });
});

describe("hosts", () => {
  const req = (host: string, at: number, via = "Bash"): Request => ({
    agentId: AgentId("a"),
    at,
    host,
    via,
    label: "",
  });

  test("busiest first, with first and last contact", () => {
    const out = hosts([
      req("a.com", 5),
      req("b.com", 1),
      req("a.com", 9, "WebFetch"),
    ]);
    expect(out).toEqual([
      { host: "a.com", count: 2, first: 5, last: 9, via: ["Bash", "WebFetch"] },
      { host: "b.com", count: 1, first: 1, last: 1, via: ["Bash"] },
    ]);
  });

  test("hostOf rejects garbage", () => {
    expect(hostOf("not a url")).toBeUndefined();
    expect(hostOf("https://x.dev/a")).toBe("x.dev");
  });
});
