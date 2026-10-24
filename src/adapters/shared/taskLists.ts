import type { AgentId } from "@/domain/ids.ts";
import {
  stamped,
  type Task,
  type TaskItem,
  type TaskSource,
} from "@/domain/task.ts";

// The task lists of one owner by source; `set` answers with the whole list only when it changed.
export const taskLists = (owner: AgentId) => {
  const lists = new Map<TaskSource, readonly Task[]>();
  let last = "";
  return {
    set(
      source: TaskSource,
      at: number,
      items: readonly TaskItem[],
    ): readonly Task[] | undefined {
      lists.set(
        source,
        stamped(source, owner, at, items, lists.get(source) ?? []),
      );
      const all = [...lists.values()].flat();
      const signature = JSON.stringify(all);
      if (signature === last) return undefined;
      last = signature;
      return all;
    },
  };
};
