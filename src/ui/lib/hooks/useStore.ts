import { useSyncExternalStore } from "react";
import type { Store } from "@/ui/lib/ports.ts";

export const useStore = <A>(store: Store<A>) =>
  useSyncExternalStore(store.subscribe, store.get);
