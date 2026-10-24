import type { Keys } from "@/ui/lib/ports.ts";

export const createKeys = () => {
  const listeners = new Set<(key: string) => void>();
  const keys: Keys = {
    subscribe: (onKey) => {
      listeners.add(onKey);
      return () => void listeners.delete(onKey);
    },
  };
  const emit = (key: string) => {
    for (const l of listeners) l(key);
  };
  return { keys, emit };
};
