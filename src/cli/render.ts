export interface Column<R> {
  readonly header: string;
  // The value JSON carries.
  readonly raw: (row: R) => unknown;
  // How a table reads it; defaults to the raw value.
  readonly show?: (row: R) => string;
}

// Rows already read into raw values (for JSON) and display strings (for the table).
export interface Table {
  readonly headers: readonly string[];
  readonly raw: readonly (readonly unknown[])[];
  readonly shown: readonly (readonly string[])[];
}

const cell = (v: unknown) =>
  v === undefined || v === null || v === "" ? "-" : String(v);

export const table = <R>(
  columns: readonly Column<R>[],
  rows: readonly R[],
): Table => ({
  headers: columns.map((c) => c.header),
  raw: rows.map((r) => columns.map((c) => c.raw(r))),
  shown: rows.map((r) =>
    columns.map((c) => cell(c.show ? c.show(r) : c.raw(r))),
  ),
});

// One thing with a story: its data for JSON and its lines for people.
export interface Doc {
  readonly data: unknown;
  readonly lines: readonly string[];
}

export type Out = Table | Doc;

export type Format = "table" | "json" | "ndjson";

export const pickFormat = (
  o: { format?: Format; json: boolean },
  tty: boolean,
): Format => o.format ?? (o.json ? "json" : tty ? "table" : "json");

// A key is the header with spaces made into underscores.
const key = (header: string) => header.toLowerCase().replace(/\s+/g, "_");

const objects = (t: Table) =>
  t.raw.map((r) => Object.fromEntries(t.headers.map((h, i) => [key(h), r[i]])));

const grid = (t: Table, header: boolean) => {
  const rows = [
    ...(header ? [t.headers.map((h) => h.toUpperCase())] : []),
    ...t.shown,
  ];
  const widths = t.headers.map((_, i) =>
    Math.max(0, ...rows.map((r) => r[i]?.length ?? 0)),
  );
  return rows
    .map((r) =>
      r
        .map((v, i) => (i === r.length - 1 ? v : v.padEnd(widths[i] ?? 0)))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
};

export const render = (out: Out, format: Format, header = true) => {
  if ("lines" in out) {
    return format === "table"
      ? out.lines.join("\n")
      : JSON.stringify(out.data, null, format === "json" ? 2 : 0);
  }
  if (format === "ndjson") {
    return objects(out)
      .map((o) => JSON.stringify(o))
      .join("\n");
  }
  if (format === "json") return JSON.stringify(objects(out), null, 2);
  return out.raw.length ? grid(out, header) : "";
};
