import type { Asset } from "@/domain/assets.ts";
import type { Run } from "@/domain/run.ts";
import type { Session } from "@/domain/session.ts";

export interface Store<A> {
  readonly get: () => A;
  readonly subscribe: (onChange: () => void) => () => void;
}

export type RunStatus = "reading" | "ended" | "failed";

export interface OpenedRun {
  readonly run: Store<Run>;
  readonly status: Store<RunStatus>;
  readonly close: () => void;
}

export interface OpenedAssets {
  readonly assets: Store<readonly Asset[]>;
  readonly close: () => void;
}

// All the UI knows of the app: no Effect types cross this line.
export interface UiPorts {
  readonly sessions: Store<readonly Session[]>;
  readonly open: (session: Session) => Promise<OpenedRun>;
  readonly openAssets: (cwd: string) => Promise<OpenedAssets>;
}

export interface Keys {
  readonly subscribe: (onKey: (key: string) => void) => () => void;
}

export type Scheme = "dark" | "light";
