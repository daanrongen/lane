import { Effect, Layer } from "effect";
import type { RawProcess } from "@/domain/presence.ts";
import { ProcessProbe } from "@/ports/ProcessProbe.ts";
import { SourceError } from "@/ports/SourceError.ts";

const run = async (cmd: string[]) => {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
};

// `ps` elapsed time is `[[dd-]hh:]mm:ss`.
export const elapsed = (etime: string) => {
  const [days, rest] = etime.includes("-") ? etime.split("-") : ["0", etime];
  const [s = 0, m = 0, h = 0] = (rest ?? "").split(":").map(Number).reverse();
  return ((Number(days) * 24 + h) * 60 + m) * 60 + s;
};

export const parsePs = (out: string, now: number) =>
  out.split("\n").flatMap((line) => {
    const m = /^\s*(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    return m?.[1] && m[2] && m[3]
      ? [
          {
            pid: Number(m[1]),
            command: m[3],
            startedAt: now - elapsed(m[2]) * 1000,
          },
        ]
      : [];
  });

// `lsof -Fpn` prints `p<pid>` then `n<path>` for each process.
export const parseCwds = (out: string) => {
  const cwds = new Map<number, string>();
  let pid = 0;
  for (const line of out.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n") && pid) cwds.set(pid, line.slice(1));
  }
  return cwds;
};

export const ProcessProbePs = Layer.succeed(ProcessProbe, {
  find: (patterns) =>
    Effect.tryPromise({
      try: async (): Promise<readonly RawProcess[]> => {
        const all = parsePs(
          await run(["ps", "-axo", "pid=,etime=,command="]),
          Date.now(),
        );
        const hits = all.filter((p) =>
          patterns.some((re) => re.test(p.command)),
        );
        if (hits.length === 0) return [];
        const cwds = parseCwds(
          await run([
            "lsof",
            "-a",
            "-d",
            "cwd",
            "-Fpn",
            "-p",
            hits.map((p) => p.pid).join(","),
          ]),
        );
        return hits.map((p) => ({ ...p, cwd: cwds.get(p.pid) }));
      },
      catch: (cause) =>
        new SourceError({ message: "cannot list processes", cause }),
    }),
});
