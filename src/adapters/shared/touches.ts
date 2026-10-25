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
