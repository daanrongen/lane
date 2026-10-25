import { type Alert, alerts } from "@/domain/alerts.ts";
import type { Floor } from "@/domain/floor.ts";
import type { Store } from "@/ui/lib/ports.ts";

// Hands over each alert as the floor changes.
export const watchAlerts = (floor: Store<Floor>, send: (a: Alert) => void) => {
  let prev: Floor | undefined = floor.get();
  return floor.subscribe(() => {
    const next = floor.get();
    for (const a of alerts(prev, next)) send(a);
    prev = next;
  });
};
