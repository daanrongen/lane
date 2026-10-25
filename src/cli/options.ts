import { Data, Option } from "effect";
import { Flag } from "effect/cli";

// `code` is the exit status: 2 for bad usage, 3 for nothing found.
export class CliError extends Data.TaggedError("CliError")<{
  readonly message: string;
  readonly code: number;
}> {}

const optional = (flag: Flag.Flag<string>) => Flag.optional(flag);
const on = (name: string, about: string) =>
  Flag.Boolean(name).pipe(Flag.withDescription(about), Flag.withDefault(false));

// Every command can choose how it prints.
export const output = {
  format: Flag.Literals("format", ["table", "json", "ndjson"]).pipe(
    Flag.withDescription("table in a terminal, json when piped"),
    Flag.optional,
  ),
  json: on("json", "print json"),
  noHeader: on("no-header", "leave the header row out of a table"),
  watch: Flag.Boolean("watch").pipe(
    Flag.withAlias("f"),
    Flag.withDescription("read again and redraw until interrupted"),
    Flag.withDefault(false),
  ),
  every: Flag.String("every").pipe(
    Flag.withDescription("seconds between reads with --watch (default 2)"),
    Flag.optional,
  ),
};

// Which agents a command looks at.
export const scope = {
  harness: optional(
    Flag.String("harness").pipe(
      Flag.withDescription("only claude, codex, ..."),
    ),
  ),
  workspace: optional(
    Flag.String("workspace").pipe(
      Flag.withAlias("w"),
      Flag.withDescription("only this directory and below"),
    ),
  ),
  limit: optional(
    Flag.String("limit").pipe(
      Flag.withAlias("n"),
      Flag.withDescription("most rows"),
    ),
  ),
  all: on("all", "every thread, not just live and recent ones"),
  noProbe: on("no-probe", "do not look at running processes"),
};

type Plain<T> = {
  [K in keyof T]: T[K] extends Option.Option<infer A> ? A | undefined : T[K];
};

// Optional flags as plain values: undefined when not given.
export const plain = <T extends object>(o: T): Plain<T> =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [
      k,
      Option.isOption(v) ? Option.getOrUndefined(v) : v,
    ]),
  ) as Plain<T>;
