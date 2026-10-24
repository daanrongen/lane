import { describe, expect, test } from "bun:test";
import { type PermissionRule, ruleFor } from "@/domain/rules.ts";

const rule = (effect: "allow" | "deny", pattern: string): PermissionRule => ({
  _tag: "Rule",
  source: "claude",
  effect,
  pattern,
});

describe("ruleFor", () => {
  test("a bare tool name covers every call of that tool", () => {
    expect(
      ruleFor([rule("allow", "WebFetch")], "WebFetch", "https://x")?.pattern,
    ).toBe("WebFetch");
    expect(ruleFor([rule("allow", "WebFetch")], "Bash", "ls")).toBeUndefined();
  });

  test("a prefix pattern covers commands that start with it", () => {
    const rules = [rule("allow", "Bash(git status:*)")];
    expect(ruleFor(rules, "Bash", "git status --short")).toBeDefined();
    expect(ruleFor(rules, "Bash", "git push")).toBeUndefined();
  });

  test("a deny beats an allow", () => {
    const rules = [rule("allow", "Read"), rule("deny", "Read(.env)")];
    expect(ruleFor(rules, "Read", ".env")?.effect).toBe("deny");
    expect(ruleFor(rules, "Read", "a.ts")?.effect).toBe("allow");
  });
});
