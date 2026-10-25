import { Clock, Effect, FileSystem, Layer } from "effect";
import { Workspaces } from "@/ports/Workspaces.ts";

const BRANCH_TTL = 5_000;

// `ref: refs/heads/main` names a branch; a bare hash is a detached head.
export const branchOf = (head: string) => {
  const ref = /^ref: refs\/heads\/(.+)$/m.exec(head)?.[1];
  return (
    ref ?? (/^[0-9a-f]{7,}/.exec(head.trim())?.[0]?.slice(0, 7) || undefined)
  );
};

// A workspace is the nearest directory up the tree holding `.git`, a folder or a worktree's pointer file.
export const WorkspacesFs = Layer.effect(
  Workspaces,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const roots = new Map<string, string>();
    const branches = new Map<string, { at: number; branch?: string }>();

    const rootOf = (cwd: string) =>
      Effect.gen(function* () {
        for (let dir = cwd; ; dir = dir.slice(0, dir.lastIndexOf("/")) || "/") {
          if (yield* fs.exists(`${dir}/.git`)) return dir;
          if (dir === "/") return cwd;
        }
      }).pipe(Effect.orElseSucceed(() => cwd));

    const headOf = (root: string) =>
      Effect.gen(function* () {
        const git = `${root}/.git`;
        const info = yield* fs.stat(git);
        const dir =
          info.type === "Directory"
            ? git
            : (yield* fs.readFileString(git)).replace(/^gitdir: /, "").trim();
        return branchOf(yield* fs.readFileString(`${dir}/HEAD`));
      }).pipe(Effect.orElseSucceed(() => undefined));

    return {
      of: (cwd) =>
        Effect.gen(function* () {
          let root = roots.get(cwd);
          if (root === undefined) {
            root = yield* rootOf(cwd);
            roots.set(cwd, root);
          }
          const now = yield* Clock.currentTimeMillis;
          let hit = branches.get(root);
          if (!hit || now - hit.at > BRANCH_TTL) {
            hit = { at: now, branch: yield* headOf(root) };
            branches.set(root, hit);
          }
          return { root, branch: hit.branch };
        }),
    };
  }),
);
