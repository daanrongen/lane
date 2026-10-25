import { useEffect, useState } from "react";
import type { Thread } from "@/domain/thread.ts";
import type { OpenedRun, UiPorts } from "@/ui/lib/ports.ts";

// Follows one thread's run while it is wanted; polls replace thread objects, so only the key reopens it.
export const useOpened = (ports: UiPorts, harness?: string, id?: string) => {
  const [opened, setOpened] = useState<OpenedRun>();
  useEffect(() => {
    const thread: Thread | undefined = ports.sessions
      .get()
      .find((t) => t.harness === harness && t.id === id);
    if (!thread) return;
    let cancelled = false;
    let current: OpenedRun | undefined;
    ports.open(thread).then((o) => {
      if (cancelled) return o.close();
      current = o;
      setOpened(o);
    });
    return () => {
      cancelled = true;
      current?.close();
      setOpened(undefined);
    };
  }, [ports, harness, id]);
  return opened;
};
