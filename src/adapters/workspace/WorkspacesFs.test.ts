import { describe, expect, test } from "bun:test";
import { Effect, FileSystem } from "effect";
import { runFs } from "@/adapters/claude/fixtures.ts";
import { branchOf, WorkspacesFs } from "@/adapters/workspace/WorkspacesFs.ts";
import { Workspaces } from "@/ports/Workspaces.ts";

const of = (cwd: string) =>
  Workspaces.use((w) => w.of(cwd)).pipe(Effect.provide(WorkspacesFs));

describe("branchOf", () => {
  test("a ref names its branch, a hash is a detached head", () => {
    expect(branchOf("ref: refs/heads/feat/billing\n")).toBe("feat/billing");
    expect(branchOf("0123456789abcdef\n")).toBe("0123456");
    expect(branchOf("")).toBeUndefined();
  });
});

describe("WorkspacesFs", () => {
  test("the root is the nearest directory with a .git, and its branch is read", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${repo}/.git`);
        yield* fs.writeFileString(
          `${repo}/.git/HEAD`,
          "ref: refs/heads/main\n",
        );
        yield* fs.makeDirectory(`${repo}/packages/ui`, { recursive: true });
        expect(yield* of(`${repo}/packages/ui`)).toEqual({
          root: repo,
          branch: "main",
        });
      }),
    ));

  test("a worktree's .git file points at its own head", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${dir}/main/.git/worktrees/wt`, {
          recursive: true,
        });
        yield* fs.writeFileString(
          `${dir}/main/.git/worktrees/wt/HEAD`,
          "ref: refs/heads/side\n",
        );
        yield* fs.makeDirectory(`${dir}/wt`);
        yield* fs.writeFileString(
          `${dir}/wt/.git`,
          `gitdir: ${dir}/main/.git/worktrees/wt\n`,
        );
        expect(yield* of(`${dir}/wt`)).toEqual({
          root: `${dir}/wt`,
          branch: "side",
        });
      }),
    ));

  test("outside any repository a directory is its own workspace", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* fs.makeTempDirectoryScoped();
        const found = yield* of(dir);
        expect(found.branch).toBeUndefined();
        expect(found.root === dir || dir.startsWith(found.root)).toBe(true);
      }),
    ));
});
