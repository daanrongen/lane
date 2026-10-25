import type { HarnessId, Thread } from "@/domain/thread.ts";

export interface RawProcess {
  readonly pid: number;
  readonly command: string;
  readonly cwd?: string;
  // Epoch ms.
  readonly startedAt?: number;
}

export interface Found extends RawProcess {
  readonly harness: HarnessId;
}

// How to tell a harness's process from the rest.
export interface Matcher {
  readonly harness: HarnessId;
  readonly test: RegExp;
}

const PROGRAM = (name: string, not: string) =>
  new RegExp(
    `^(?:(?:node|bun)\\s+)?(?:\\S*/)?${name}(?:\\.js)?(?:\\s+(?!(?:${not})\\b)|$)`,
  );

export const MATCHERS: readonly Matcher[] = [
  {
    harness: "claude",
    test: PROGRAM("claude", "mcp|doctor|update|install|config|setup-token"),
  },
  {
    harness: "codex",
    test: PROGRAM("codex", "mcp|mcp-server|login|logout|completion|app-server"),
  },
  { harness: "ollama", test: /^(?:\S*\/)?ollama\s+run\b/ },
];

export const find = (
  procs: readonly RawProcess[],
  matchers: readonly Matcher[] = MATCHERS,
): Found[] =>
  procs.flatMap((p) => {
    const m = matchers.find((x) => x.test.test(p.command));
    return m ? [{ ...p, harness: m.harness }] : [];
  });

// A process backs a thread in its directory: threads already live are counted first, then the newest quiet ones come alive. Processes no thread explains stay on their own.
export const presence = (
  threads: readonly Thread[],
  procs: readonly Found[],
): { threads: readonly Thread[]; orphans: readonly Found[] } => {
  const promoted = new Set<Thread>();
  const orphans: Found[] = [];
  const groups = new Map<string, Found[]>();
  for (const p of procs) {
    if (!p.cwd) {
      orphans.push(p);
      continue;
    }
    const key = `${p.harness}\0${p.cwd}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const [key, group] of groups) {
    const [harness, cwd] = key.split("\0");
    const here = threads.filter((t) => t.harness === harness && t.cwd === cwd);
    let need = group.length - here.filter((t) => t.status !== "past").length;
    const quiet = here
      .filter((t) => t.status === "past")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(0, need));
    for (const t of quiet) promoted.add(t);
    need -= quiet.length;
    // The newest process is the one with no transcript yet.
    const byAge = [...group].sort(
      (a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0),
    );
    orphans.push(...byAge.slice(byAge.length - Math.max(0, need)));
  }
  return {
    threads: threads.map((t) =>
      promoted.has(t) ? { ...t, status: "idle" as const } : t,
    ),
    orphans,
  };
};
