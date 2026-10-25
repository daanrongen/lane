import { Clock, Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { readFloor } from "@/app/Snapshot.ts";
import { since } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { limitOf } from "@/cli/filters.ts";
import { output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import type { Reach } from "@/cli/thread.ts";
import { refLabel } from "@/domain/pivot.ts";
import { resolvePath, within } from "@/domain/workspace.ts";
import { clip } from "@/ui/lib/format.ts";

interface Filter extends Reach {
  readonly kind?: string;
  readonly agent?: string;
  readonly text?: string;
  readonly touching?: string;
}

const has = (hay: string, needle: string) =>
  hay.toLowerCase().includes(needle.toLowerCase());

export const feedList = (o: Filter, cwd: string) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const who = new Map(floor.agents.map((a) => [a.ref, a]));
    const root =
      o.workspace === undefined ? undefined : resolvePath(cwd, o.workspace);
    const words = (o.text ?? "").split(/\s+/).filter(Boolean);
    const rows = floor.feed
      .filter((i) => {
        const a = who.get(i.agent);
        const text = `${i.label} ${i.kind} ${a?.name ?? ""}`;
        return (
          (!o.harness || a?.harness === o.harness) &&
          (!root || (a && within(root, a.workspace))) &&
          (!o.kind || i.kind === o.kind) &&
          (!o.agent || has(`${i.agent} ${a?.name ?? ""}`, o.agent)) &&
          words.every((w) => has(text, w)) &&
          (!o.touching ||
            i.touches.some((t) => has(refLabel(t), o.touching ?? "")))
        );
      })
      .slice(0, limitOf(o));
    return table(
      [
        {
          header: "at",
          raw: (i) => i.at,
          show: (i) => since(now, i.at) ?? "",
        },
        {
          header: "agent",
          raw: (i) => i.agent,
          show: (i) => who.get(i.agent)?.name ?? i.agent,
        },
        { header: "kind", raw: (i) => i.kind },
        { header: "status", raw: (i) => i.status },
        {
          header: "label",
          raw: (i) => i.label,
          show: (i) => clip(i.label, 70),
        },
        {
          header: "touches",
          raw: (i) => i.touches.map(refLabel),
          show: (i) => clip(i.touches.map(refLabel).join(", "), 40),
        },
      ],
      rows,
    );
  });

export const feed = Command.make(
  "feed",
  {
    ...output,
    ...scope,
    kind: Flag.String("kind").pipe(
      Flag.withDescription("read, edit, shell, search, fetch, mcp, ..."),
      Flag.optional,
    ),
    agent: Flag.String("agent").pipe(
      Flag.withDescription("an agent's name or ref"),
      Flag.optional,
    ),
    text: Flag.String("text").pipe(
      Flag.withDescription("words that label, kind or agent must contain"),
      Flag.optional,
    ),
    touching: Flag.String("touching").pipe(
      Flag.withDescription("a file, host, MCP server, skill or command"),
      Flag.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, feedList(o, process.cwd()));
  },
).pipe(Command.withDescription("What every agent did lately, newest first"));
