import { describe, expect, test } from "bun:test";
import {
  elapsed,
  parseCwds,
  parsePs,
} from "@/adapters/process/ProcessProbePs.ts";

describe("ps output", () => {
  test("elapsed time reads seconds, minutes, hours and days", () => {
    expect(elapsed("00:05")).toBe(5);
    expect(elapsed("12:05")).toBe(725);
    expect(elapsed("1:02:03")).toBe(3723);
    expect(elapsed("2-00:00:01")).toBe(172_801);
  });

  test("each line is a pid, its age and its command", () => {
    const out =
      "  12  01:00 /bin/claude --resume x\n 345 3-00:00:00 ollama run gemma\nnot a row\n";
    expect(parsePs(out, 1_000_000)).toEqual([
      {
        pid: 12,
        command: "/bin/claude --resume x",
        startedAt: 1_000_000 - 60_000,
      },
      {
        pid: 345,
        command: "ollama run gemma",
        startedAt: 1_000_000 - 259_200_000,
      },
    ]);
  });

  test("lsof pairs each pid with its directory", () => {
    const cwds = parseCwds("p12\nn/w/api\np345\nn/w/lab\n");
    expect(cwds.get(12)).toBe("/w/api");
    expect(cwds.get(345)).toBe("/w/lab");
  });
});
