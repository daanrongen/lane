import type { TaskStatus } from "@/domain/task.ts";

const STATUS: Record<string, TaskStatus> = {
  pending: "next",
  in_progress: "doing",
  completed: "done",
};

export const statusOf = (raw: unknown): TaskStatus =>
  STATUS[String(raw)] ?? "next";
