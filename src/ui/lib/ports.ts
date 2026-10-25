import type { Asset } from "@/domain/assets.ts";
import type { Floor } from "@/domain/floor.ts";
import type { HarnessProfile } from "@/domain/profile.ts";
import type { Run } from "@/domain/run.ts";
import type { Task } from "@/domain/task.ts";
import type { Thread } from "@/domain/thread.ts";

export interface Store<A> {
  readonly get: () => A;
  readonly subscribe: (onChange: () => void) => () => void;
}

export type RunStatus = "reading" | "ended" | "failed";

export interface OpenedRun {
  readonly run: Store<Run>;
  readonly status: Store<RunStatus>;
  readonly tasks: Store<readonly Task[]>;
  readonly close: () => void;
}

export interface OpenedAssets {
  readonly assets: Store<readonly Asset[]>;
  readonly close: () => void;
}

// All the UI knows of the app: no Effect types cross this line.
export interface UiPorts {
  readonly floor: Store<Floor>;
  // What each workspace has set up for its agents, by workspace root.
  readonly setups: Store<Readonly<Record<string, readonly Asset[]>>>;
  readonly profiles: readonly HarnessProfile[];
  readonly sessions: Store<readonly Thread[]>;
  readonly open: (session: Thread) => Promise<OpenedRun>;
  readonly openAssets: (cwd: string) => Promise<OpenedAssets>;
}

export interface Keys {
  readonly subscribe: (onKey: (key: string) => void) => () => void;
}

export type Scheme = "dark" | "light";
