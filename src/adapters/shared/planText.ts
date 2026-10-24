import type { TaskItem, TaskStatus } from "@/domain/task.ts";

const MAX_ITEMS = 12;
const clip = (s: string) => (s.length > 70 ? `${s.slice(0, 69)}…` : s);

// A plan's steps: its `##` headings, else its numbered or bulleted lines. All still to do.
export const planItems = (markdown: string): TaskItem[] => {
  const lines = markdown.split("\n");
  const headings = lines.flatMap((l) => /^#{2,3}\s+(.+)$/.exec(l)?.[1] ?? []);
  const bullets = lines.flatMap(
    (l) => /^(?:\d+\.|[-*])\s+(.+)$/.exec(l)?.[1] ?? [],
  );
  return (headings.length ? headings : bullets)
    .map((t) =>
      t.replace(/^(?:\d+[.)]|Phase \d+:?)\s*/i, "").replace(/[*`]/g, ""),
    )
    .filter((t) => t.length > 0)
    .slice(0, MAX_ITEMS)
    .map((title) => ({ title: clip(title), status: "next" as TaskStatus }));
};

const STATUS: Record<string, TaskStatus> = {
  pending: "next",
  in_progress: "doing",
  completed: "done",
};

export const statusOf = (raw: unknown): TaskStatus =>
  STATUS[String(raw)] ?? "next";
