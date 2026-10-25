import type { Keys } from "@/ui/lib/ports.ts";

export const createKeys = () => {
  const listeners = new Set<(key: string) => void>();
  let typing = false;
  const keys: Keys = {
    subscribe: (onKey) => {
      listeners.add(onKey);
      return () => void listeners.delete(onKey);
    },
    typing: (on) => {
      typing = on;
    },
  };
  const emit = (key: string) => {
    for (const l of listeners) l(key);
  };
  return { keys, emit, typing: () => typing };
};
