import { describe, expect, test } from "bun:test";
import { pickThread } from "@/cli/select.ts";
import { ThreadId } from "@/domain/ids.ts";
import type { Thread } from "@/domain/thread.ts";

const t = (id: string, cwd: string, name?: string): Thread => ({
  harness: "claude",
  id: ThreadId(id),
  cwd,
  status: "past",
  name,
  updatedAt: 0,
});

const threads = [
  t("abc123", "/w/shop", "fix billing"),
  t("abd456", "/w/shop/api", "add pricing"),
  t("zzz789", "/w/docs"),
];

const id = (p: ReturnType<typeof pickThread>) =>
  p.ok ? p.thread.id : p.message;

describe("pickThread", () => {
  test("exact id, harness:id and a unique prefix", () => {
    expect(id(pickThread(threads, "abc123", "/"))).toBe("abc123");
    expect(id(pickThread(threads, "claude:zzz789", "/"))).toBe("zzz789");
    expect(id(pickThread(threads, "zz", "/"))).toBe("zzz789");
  });

  test("a shared prefix is ambiguous and lists the candidates", () => {
    const p = pickThread(threads, "ab", "/");
    expect(p.ok).toBe(false);
    expect(id(p)).toContain("abc123");
    expect(id(p)).toContain("abd456");
  });

  test("a directory gives its newest thread, `.` is the cwd", () => {
    expect(id(pickThread(threads, "/w/shop", "/"))).toBe("abc123");
    expect(id(pickThread(threads, ".", "/w/docs"))).toBe("zzz789");
  });

  test("a name fragment matches", () => {
    expect(id(pickThread(threads, "pricing", "/"))).toBe("abd456");
  });

  test("nothing matching says so", () => {
    expect(id(pickThread(threads, "nope", "/"))).toContain("no thread");
  });
});
