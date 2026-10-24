import { readScheme } from "@/adapters/macos/effectiveAppearance.ts";

export type Scheme = "dark" | "light";

const FLAG = "--appearance";

// A fresh process sees the current appearance, so the app re-runs itself to ask.
// Its entry point calls this first, which keeps the compiled binary self-contained.
export const answerAppearanceQuery = () => {
  if (!process.argv.includes(FLAG)) return;
  console.log(readScheme());
  process.exit(0);
};

const read = async (): Promise<Scheme> => {
  const proc = Bun.spawn([process.execPath, ...process.argv.slice(1), FLAG], {
    stdout: "pipe",
    stderr: "ignore",
  });
  return (await new Response(proc.stdout).text()).trim() === "dark"
    ? "dark"
    : "light";
};

// Ghostty switches theme with the system appearance, so the UI polls it too.
export const watchScheme = async (everyMs = 1000) => {
  let scheme = await read();
  const listeners = new Set<() => void>();
  setInterval(async () => {
    const next = await read();
    if (next === scheme) return;
    scheme = next;
    for (const l of listeners) l();
  }, everyMs).unref();
  return {
    get: () => scheme,
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
};
