import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import type { Loaded } from "@/app/assemble.ts";
import { readAssets } from "@/app/openAssets.ts";
import { emit } from "@/cli/emit.ts";
import { limitOf } from "@/cli/filters.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import { loadRuns, type Reach } from "@/cli/thread.ts";
import { type Asset, ofKind } from "@/domain/assets.ts";
import { mcpServers } from "@/domain/mcp.ts";
import { modelsUsed } from "@/domain/models.ts";
import { hosts as hostsOf } from "@/domain/network.ts";
import { skillKey, skillsUsed } from "@/domain/skills.ts";
import { resolvePath } from "@/domain/workspace.ts";
import { Assets } from "@/ports/Assets.ts";
import { clip, tokens } from "@/ui/lib/format.ts";

interface Rolled {
  readonly name: string;
  readonly count: number;
  readonly threads: number;
  readonly note?: string;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// Each thread is summarised on its own, then equal names are added up.
const rolled = <T>(
  loaded: readonly Loaded[],
  per: (l: Loaded) => readonly T[],
  name: (t: T) => string,
  count: (t: T) => number,
  note: (name: string, items: readonly T[]) => string | undefined = () =>
    undefined,
): Rolled[] => {
  const groups = new Map<string, T[]>();
  const seen = new Map<string, number>();
  for (const l of loaded) {
    for (const t of per(l)) {
      groups.set(name(t), [...(groups.get(name(t)) ?? []), t]);
      seen.set(name(t), (seen.get(name(t)) ?? 0) + 1);
    }
  }
  return [...groups]
    .map(([n, items]) => ({
      name: n,
      count: sum(items.map(count)),
      threads: seen.get(n) ?? 0,
      note: note(n, items),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const catalog = (o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const readers = yield* Assets;
    return yield* readAssets(
      readers,
      o.workspace === undefined ? cwd : resolvePath(cwd, o.workspace),
    );
  });

const view = (name: string, countHeader: string, rows: readonly Rolled[]) =>
  table(
    [
      { header: name, raw: (r: Rolled) => r.name },
      { header: countHeader, raw: (r) => r.count },
      { header: "threads", raw: (r) => r.threads },
      {
        header: "note",
        raw: (r) => r.note,
        show: (r) => clip(r.note ?? "", 60),
      },
    ],
    rows,
  );

export const mcpList = (arg: string | undefined, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const loaded = yield* loadRuns(arg, o, cwd);
    const known = ofKind(yield* catalog(o, cwd), "Mcp");
    const rows = rolled(
      loaded,
      (l) => mcpServers(l.run.setups, l.run.spans),
      (s) => s.name,
      (s) => s.calls,
      (n, items) =>
        [
          known.find((k) => k.name === n)?.transport ?? "not configured here",
          `${Math.max(0, ...items.map((s) => s.tools))} tools`,
          `${tokens(Math.max(0, ...items.map((s) => s.tokens)))} tokens`,
          ...(sum(items.map((s) => s.failed))
            ? [`${sum(items.map((s) => s.failed))} failed`]
            : []),
        ].join(", "),
    );
    return view("server", "calls", rows.slice(0, limitOf(o)));
  });

export const skillsList = (arg: string | undefined, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const loaded = yield* loadRuns(arg, o, cwd);
    const known: readonly Asset[] = yield* catalog(o, cwd);
    const rows = rolled(
      loaded,
      (l) => skillsUsed(l.run.skills),
      (s) => s.name,
      (s) => s.count,
      (n) =>
        ofKind(known, "Skill").find((s) => s.name === skillKey(n))?.description,
    );
    return view("skill", "uses", rows.slice(0, limitOf(o)));
  });

export const hostsList = (arg: string | undefined, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const loaded = yield* loadRuns(arg, o, cwd);
    const rows = rolled(
      loaded,
      (l) => hostsOf(l.run.requests),
      (h) => h.host,
      (h) => h.count,
      (_, items) => [...new Set(items.flatMap((h) => h.via))].join(", "),
    );
    return view("host", "requests", rows.slice(0, limitOf(o)));
  });

export const modelsList = (arg: string | undefined, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const loaded = yield* loadRuns(arg, o, cwd);
    const rows = rolled(
      loaded,
      (l) => modelsUsed(l.run.turns),
      (m) => m.model,
      (m) => m.turns,
      (_, items) =>
        [
          items[0]?.provider ?? "unknown provider",
          `${tokens(sum(items.map((m) => m.output)))} out`,
        ].join(", "),
    );
    return view("model", "turns", rows.slice(0, limitOf(o)));
  });

const rollup = (
  name: string,
  about: string,
  answer: (
    arg: string | undefined,
    o: Reach,
    cwd: string,
  ) => ReturnType<typeof mcpList>,
) =>
  Command.make(
    name,
    {
      ...output,
      ...scope,
      thread: Argument.String("thread").pipe(
        Argument.withDescription("one thread; else every live and recent one"),
        Argument.optional,
      ),
    },
    (c) => {
      const o = plain(c);
      return emit(o, answer(o.thread, o, process.cwd()));
    },
  ).pipe(Command.withDescription(about));

export const mcp = rollup(
  "mcp",
  "MCP servers agents were given and called, against what is configured",
  mcpList,
);
export const skills = rollup(
  "skills",
  "Skills agents used, with what the catalog says they are for",
  skillsList,
);
export const hosts = rollup(
  "hosts",
  "Hosts and programs agents reached outside the machine",
  hostsList,
);
export const models = rollup(
  "models",
  "Models that answered, busiest first",
  modelsList,
);
