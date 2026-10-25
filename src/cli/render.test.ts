import { describe, expect, test } from "bun:test";
import { pickFormat, render, table } from "@/cli/render.ts";

const t = table(
  [
    { header: "name", raw: (r: { n: string; at: number }) => r.n },
    {
      header: "updated at",
      raw: (r) => r.at,
      show: (r) => `${r.at / 1000}s`,
    },
  ],
  [
    { n: "a", at: 5000 },
    { n: "longer", at: 1000 },
  ],
);

describe("render", () => {
  test("a table aligns columns under uppercase headers", () => {
    expect(render(t, "table")).toBe(
      ["NAME    UPDATED AT", "a       5s", "longer  1s"].join("\n"),
    );
  });

  test("json carries raw values under snake_case keys", () => {
    expect(JSON.parse(render(t, "json"))).toEqual([
      { name: "a", updated_at: 5000 },
      { name: "longer", updated_at: 1000 },
    ]);
  });

  test("ndjson is one object per line", () => {
    expect(render(t, "ndjson").split("\n")).toHaveLength(2);
  });

  test("a missing value reads as a dash, and no header drops the row", () => {
    const x = table([{ header: "v", raw: () => undefined }], [1]);
    expect(render(x, "table", false)).toBe("-");
  });

  test("a doc prints its lines, or its data as json", () => {
    const doc = { data: { a: 1 }, lines: ["one", "two"] };
    expect(render(doc, "table")).toBe("one\ntwo");
    expect(JSON.parse(render(doc, "json"))).toEqual({ a: 1 });
  });
});

describe("pickFormat", () => {
  test("a terminal gets a table and a pipe gets json", () => {
    expect(pickFormat({ json: false }, true)).toBe("table");
    expect(pickFormat({ json: false }, false)).toBe("json");
  });

  test("flags win", () => {
    expect(pickFormat({ json: true }, true)).toBe("json");
    expect(pickFormat({ json: false, format: "table" }, false)).toBe("table");
    expect(pickFormat({ json: true, format: "ndjson" }, true)).toBe("ndjson");
  });
});
