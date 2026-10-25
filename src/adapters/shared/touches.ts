import type { Edit } from "@/domain/act.ts";
import type { RunEvent } from "@/domain/events.ts";
import { ActId } from "@/domain/ids.ts";
import type { Target } from "@/domain/network.ts";
import { command, file, host, programOf, type Ref } from "@/domain/ref.ts";

export const hostRefs = (targets: readonly Target[]): Ref[] =>
  [...new Set(targets.map((t) => t.host))].map(host);

export const commandRefs = (cmd: string | undefined): Ref[] => {
  const program = cmd ? programOf(cmd) : undefined;
  return program ? [command(program)] : [];
};

const PATCH_FILE = /^\*\*\* (Add|Update|Delete) File: (.+)$/gm;
const OPS = { Add: "create", Update: "modify", Delete: "delete" } as const;

// Files an `apply_patch` body changes, in order.
export const patchFiles = (text: string) =>
  [...text.matchAll(PATCH_FILE)].flatMap((m) => {
    const op = OPS[m[1] as keyof typeof OPS];
    const path = m[2]?.trim();
    return path ? [{ path, op }] : [];
  });

export const touchEvents = (
  id: string,
  touched: readonly Ref[],
  edit?: Edit,
): RunEvent[] =>
  touched.length || edit
    ? [
        {
          _tag: "ActUpdated",
          id: ActId(id),
          touched,
          kind: edit ? "edit" : undefined,
          edit,
        },
      ]
    : [];

export const patchRefs = (text: string) =>
  patchFiles(text).map((f) => file(f.path));

const QUOTED = /(?<!>\s*)(["'])(?:\\.|(?!\1).)*\1/g;
const REDIRECT = /(?<![&2=-])>>?(?!&)\s*(["']?)([^\s|&;<>()"']+)\1/g;
const TEE = /\btee\s+(?:-\w+\s+)*([^\s|&;<>()]+)/g;
const SED_I =
  /\bsed\s+(?:-\S+\s+)*-i\S*\s+(?:-\S+\s+|'[^']*'\s+|"[^"]*"\s+|\S+\s+)*?([^\s|&;<>]+)\s*(?:$|[|&;])/g;
const MOVE = /\b(?:mv|cp)\s+(?:-\w+\s+)*\S+\s+([^\s|&;<>()]+)/g;

// The body of a heredoc is text, not shell; an unfinished one runs to the end.
const HEREDOC = /(<<-?\s*(["']?)(\w+)\2[^\n]*)\n[\s\S]*?(?:\n\s*\3\b|$)/g;

const real = (p: string) => !/^[$&='-]|^\/dev\/|^\d+$/.test(p);

// Files a shell command writes, as far as its text shows.
export const shellWrites = (cmd: string | undefined): string[] => {
  if (!cmd) return [];
  const bare = cmd.replace(HEREDOC, "$1").replace(QUOTED, "''");
  const found = [
    ...[...bare.matchAll(REDIRECT)].map((m) => m[2]),
    ...[...bare.matchAll(TEE)].map((m) => m[1]),
    ...[...bare.matchAll(SED_I)].map((m) => m[1]),
    ...[...bare.matchAll(MOVE)].map((m) => m[1]),
  ];
  return [...new Set(found.filter((p): p is string => !!p && real(p)))];
};
