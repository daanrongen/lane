import { homedir } from "node:os";
import type { Thread } from "@/domain/thread.ts";
import { ago } from "@/ui/lib/format.ts";

export const tilde = (path: string) => {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`)
    ? `~${path.slice(home.length)}`
    : path;
};

const SHORT = 8;

export const shortId = (id: string) => id.slice(0, SHORT);

export const threadKey = (t: Pick<Thread, "harness" | "id">) =>
  `${t.harness}:${t.id}`;

export const threadShort = (t: Pick<Thread, "harness" | "id">) =>
  `${t.harness}:${shortId(t.id)}`;

// How long before `now`, as the GUI says it.
export const since = (now: number, at: number | undefined) =>
  at === undefined ? undefined : ago(now - at);
