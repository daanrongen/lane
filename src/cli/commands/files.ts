import { Clock, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { readFloor } from "@/app/Snapshot.ts";
import { since, tilde } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { limitOf } from "@/cli/filters.ts";
import { CliError, output, plain, scope } from "@/cli/options.ts";
import { table } from "@/cli/render.ts";
import type { Reach } from "@/cli/thread.ts";
import type { TreeNode } from "@/domain/tree.ts";
import { resolvePath, within } from "@/domain/workspace.ts";

const leaves = (n: TreeNode): TreeNode[] =>
  n.kind === "file" ? [n] : n.children.flatMap(leaves);

export const filesList = (
  o: Reach & { edited: boolean; shared: boolean },
  cwd: string,
) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const who = new Map(floor.agents.map((a) => [a.ref as string, a.name]));
    const root =
      o.workspace === undefined ? undefined : resolvePath(cwd, o.workspace);
    const rows = floor.workspaces
      .filter((w) => !root || within(root, w.root))
      .flatMap((w) =>
        leaves(w.tree).map((f) => {
          const uses = Object.entries(f.agents);
          return {
            workspace: w.root,
            path: f.path,
            agents: uses.map(([ref]) => who.get(ref) ?? ref),
            reads: uses.reduce((n, [, p]) => n + p.reads, 0),
            edits: uses.reduce((n, [, p]) => n + p.edits, 0),
            collided: f.collided,
            last: Math.max(0, ...uses.map(([, p]) => p.last)),
          };
        }),
      )
      .filter(
        (f) => (!o.edited || f.edits > 0) && (!o.shared || f.agents.length > 1),
      )
      .sort((a, b) => b.last - a.last)
      .slice(0, limitOf(o));
    return table(
      [
        {
          header: "file",
          raw: (f) => f.path,
          show: (f) => f.path.slice(f.workspace.length + 1) || f.path,
        },
        {
          header: "workspace",
          raw: (f) => f.workspace,
          show: (f) => tilde(f.workspace),
        },
        {
          header: "agents",
          raw: (f) => f.agents,
          show: (f) => f.agents.join(", "),
        },
        { header: "reads", raw: (f) => f.reads },
        { header: "edits", raw: (f) => f.edits },
        {
          header: "collided",
          raw: (f) => f.collided,
          show: (f) => (f.collided ? "yes" : ""),
        },
        {
          header: "last",
          raw: (f) => f.last,
          show: (f) => since(now, f.last) ?? "",
        },
      ],
      rows,
    );
  });

const lines = (
  n: TreeNode,
  names: ReadonlyMap<string, string>,
  depth = 0,
): string[] => {
  const uses = Object.entries(n.agents);
  const note =
    n.more !== undefined
      ? ` (+${n.more})`
      : n.kind === "file"
        ? `  ${uses.map(([ref, p]) => `${names.get(ref) ?? ref} r${p.reads} e${p.edits}`).join(", ")}${n.collided ? "  collided" : ""}`
        : "";
  return [
    `${"  ".repeat(depth)}${n.name}${n.kind === "folder" ? "/" : ""}${note}`,
    ...n.children.flatMap((c) => lines(c, names, depth + 1)),
  ];
};

export const treeShow = (arg: string | undefined, o: Reach, cwd: string) =>
  Effect.gen(function* () {
    const { floor } = yield* readFloor({ all: o.all, probe: !o.noProbe });
    const path = resolvePath(cwd, arg ?? ".");
    const found = floor.workspaces
      .filter((w) => within(w.root, path) || within(path, w.root))
      .sort((a, b) => b.root.length - a.root.length)[0];
    if (!found) {
      return yield* new CliError({
        message: `no workspace with agents at ${tilde(path)}`,
        code: 3,
      });
    }
    const names = new Map(floor.agents.map((a) => [a.ref as string, a.name]));
    return {
      data: found,
      lines: [
        `${tilde(found.root)}${found.branch ? ` (${found.branch})` : ""}`,
        ...found.tree.children.flatMap((c) => lines(c, names, 1)),
      ],
    };
  });

export const files = Command.make(
  "files",
  {
    ...output,
    ...scope,
    edited: Flag.Boolean("edited").pipe(
      Flag.withDescription("only files an agent changed"),
      Flag.withDefault(false),
    ),
    shared: Flag.Boolean("shared").pipe(
      Flag.withDescription("only files more than one agent touched"),
      Flag.withDefault(false),
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, filesList(o, process.cwd()));
  },
).pipe(
  Command.withDescription("Files agents have read or changed, latest first"),
);

export const tree = Command.make(
  "tree",
  {
    ...output,
    all: scope.all,
    noProbe: scope.noProbe,
    workspace: Argument.String("workspace").pipe(
      Argument.withDescription("a directory in a workspace; defaults to here"),
      Argument.optional,
    ),
  },
  (c) => {
    const o = plain(c);
    return emit(o, treeShow(o.workspace, o, process.cwd()));
  },
).pipe(
  Command.withDescription("The part of a workspace's tree agents have touched"),
);
