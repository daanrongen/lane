import type { Thread } from "@/domain/thread.ts";
import { resolvePath, within } from "@/domain/workspace.ts";

export type Pick =
  | { readonly ok: true; readonly thread: Thread }
  | { readonly ok: false; readonly message: string };

const label = (t: Thread) => `${t.harness}:${t.id}  ${t.name ?? t.cwd}`;

const one = (found: readonly Thread[], what: string): Pick | undefined => {
  const [first] = found;
  if (found.length === 1 && first) return { ok: true, thread: first };
  if (found.length > 1) {
    return {
      ok: false,
      message: `${what} is ambiguous:\n${found.slice(0, 8).map(label).join("\n")}`,
    };
  }
  return undefined;
};

// Newest first is assumed. Exact id, `harness:id`, id prefix, a directory (its newest thread), then name.
export const pickThread = (
  threads: readonly Thread[],
  arg: string,
  cwd: string,
): Pick => {
  const exact = threads.filter(
    (t) => t.id === arg || `${t.harness}:${t.id}` === arg,
  );
  const prefixed = threads.filter(
    (t) => t.id.startsWith(arg) || `${t.harness}:${t.id}`.startsWith(arg),
  );
  const root = resolvePath(cwd, arg);
  const here = threads.filter((t) => within(root, t.cwd));
  const named = threads.filter((t) =>
    t.name?.toLowerCase().includes(arg.toLowerCase()),
  );
  return (
    one(exact, `"${arg}"`) ??
    one(prefixed, `"${arg}"`) ??
    (arg.includes("/") || arg === "." || arg === ".."
      ? here[0] && { ok: true as const, thread: here[0] }
      : undefined) ??
    one(named, `"${arg}"`) ?? {
      ok: false,
      message: `no thread matches "${arg}"`,
    }
  );
};
