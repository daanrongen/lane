export type Scheme = "dark" | "light";

const probe = new URL("./effectiveAppearance.ts", import.meta.url).pathname;

const read = async (): Promise<Scheme> => {
  const proc = Bun.spawn([process.execPath, probe], {
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
