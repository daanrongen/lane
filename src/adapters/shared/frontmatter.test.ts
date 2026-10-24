import { describe, expect, test } from "bun:test";
import { frontmatter } from "@/adapters/shared/frontmatter.ts";

describe("frontmatter", () => {
  test("reads plain and quoted values between the fences", () => {
    const text = `---\nname: mise\ndescription: "Manage tools: fast"\ncompat: 'x'\n---\n# body\nname: no`;
    expect(frontmatter(text)).toEqual({
      name: "mise",
      description: "Manage tools: fast",
      compat: "x",
    });
  });

  test("no fences means no metadata", () => {
    expect(frontmatter("# just a doc\nname: nope")).toEqual({});
  });
});
