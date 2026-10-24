import type { Request } from "@/domain/run.ts";

export interface Target {
  readonly host: string;
  readonly label: string;
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).host || undefined;
  } catch {
    return undefined;
  }
};

const URL_PATTERN = /https?:\/\/[^\s"'`<>)\]]+/g;

// Programs that talk to the network, with the subcommands that do.
const NETWORKED: Readonly<Record<string, RegExp | true>> = {
  curl: true,
  wget: true,
  ssh: true,
  scp: true,
  rsync: true,
  gh: true,
  git: /^(push|pull|fetch|clone|ls-remote)$/,
  npm: /^(install|i|add|ci|publish|view|info|update)$/,
  pnpm: /^(install|i|add|publish|update)$/,
  yarn: /^(install|add|publish|upgrade)$/,
  bun: /^(add|install|x|update)$/,
  bunx: true,
  npx: true,
  pip: /^install$/,
  pip3: /^install$/,
  uv: /^(add|sync|pip)$/,
  brew: /^(install|update|upgrade)$/,
  docker: /^(pull|push)$/,
};

const SEGMENT = /&&|\|\||;|\||\n/;
const ASSIGN = /^[A-Za-z_]\w*=/;

const programOf = (segment: string) => {
  const words = segment.trim().split(/\s+/);
  const at = words.findIndex((w) => !ASSIGN.test(w) && w !== "sudo");
  const [program, sub] = [words[at], words[at + 1] ?? ""];
  const rule = program ? NETWORKED[program] : undefined;
  return rule === true || rule?.test(sub) ? program : undefined;
};

// A URL names its host; otherwise a networked program stands in for it.
export const targetsOfCommand = (command: string): Target[] => {
  const urls = command.match(URL_PATTERN) ?? [];
  const named = urls.flatMap((url) => {
    const host = hostOf(url);
    return host ? [{ host, label: url }] : [];
  });
  if (named.length) return named;
  return command.split(SEGMENT).flatMap((segment) => {
    const program = programOf(segment);
    return program
      ? [{ host: program, label: segment.trim().slice(0, 80) }]
      : [];
  });
};

export interface HostSummary {
  readonly host: string;
  readonly count: number;
  readonly first: number;
  readonly last: number;
  readonly via: readonly string[];
}

// Busiest destinations first.
export const hosts = (requests: readonly Request[]): HostSummary[] => {
  const byHost = new Map<string, HostSummary>();
  for (const r of requests) {
    const prev = byHost.get(r.host);
    byHost.set(r.host, {
      host: r.host,
      count: (prev?.count ?? 0) + 1,
      first: Math.min(prev?.first ?? r.at, r.at),
      last: Math.max(prev?.last ?? r.at, r.at),
      via: [...new Set([...(prev?.via ?? []), r.via])],
    });
  }
  return [...byHost.values()].sort(
    (a, b) => b.count - a.count || a.host.localeCompare(b.host),
  );
};
