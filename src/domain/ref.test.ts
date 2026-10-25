import { describe, expect, test } from "bun:test";
import { canReport, support } from "@/domain/profile.ts";
import {
  command,
  file,
  folder,
  host,
  mcp,
  programOf,
  refKey,
} from "@/domain/ref.ts";

describe("refKey", () => {
  test("refs of the same thing share a key", () => {
    expect(refKey(file("/a/b.ts"))).toBe(refKey(file("/a/b.ts")));
    expect(refKey(mcp("linear", "list"))).toBe(refKey(mcp("linear", "create")));
  });

  test("a file and a folder at one path are different things", () => {
    expect(refKey(file("/a"))).not.toBe(refKey(folder("/a")));
  });

  test("kinds never collide", () => {
    const keys = [file("x"), host("x"), command("x")].map(refKey);
    expect(new Set(keys).size).toBe(3);
  });
});

describe("programOf", () => {
  test("skips env assignments and sudo", () => {
    expect(programOf("FOO=1 BAR=2 sudo git push")).toBe("git");
    expect(programOf("  bun test")).toBe("bun");
  });

  test("an empty command has no program", () => {
    expect(programOf("  ")).toBeUndefined();
  });
});

describe("profile", () => {
  const profile = {
    id: "aider",
    name: "Aider",
    facets: { edits: "native", plan: "partial" },
  } as const;

  test("a facet left out is none", () => {
    expect(support(profile, "edits")).toBe("native");
    expect(support(profile, "mcp")).toBe("none");
  });

  test("n/a means the harness cannot report it", () => {
    expect(canReport(profile, "plan")).toBe(true);
    expect(canReport(profile, "mcp")).toBe(false);
    expect(canReport(undefined, "edits")).toBe(false);
  });
});
