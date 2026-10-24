import { useWindowSize } from "@gpuix/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "@/domain/assets.ts";
import type { Session } from "@/domain/session.ts";
import { Text } from "@/ui/atoms/Text.tsx";
import { MetricsContext } from "@/ui/lib/context.ts";
import { sessionTitle } from "@/ui/lib/format.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import type {
  Keys,
  OpenedAssets,
  OpenedRun,
  Store,
  UiPorts,
} from "@/ui/lib/ports.ts";
import { responsive } from "@/ui/lib/responsive.ts";
import {
  groupByDirectory,
  keyOf,
  type Move,
  move,
} from "@/ui/lib/sessionsNav.ts";
import { KeyHints } from "@/ui/organisms/KeyHints.tsx";
import { SessionList } from "@/ui/organisms/SessionList.tsx";
import { SessionSwitcher } from "@/ui/organisms/SessionSwitcher.tsx";
import { RunPage } from "@/ui/pages/RunPage.tsx";
import { DashboardTemplate } from "@/ui/templates/DashboardTemplate.tsx";
import { PaneTemplate } from "@/ui/templates/PaneTemplate.tsx";

const ZOOM = { min: 0.6, max: 2.4, step: 0.1 };
const clampZoom = (z: number) =>
  Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, z)) * 10) / 10;

const useOpened = (ports: UiPorts, session: Session | undefined) => {
  const [opened, setOpened] = useState<OpenedRun>();
  const latest = useRef(session);
  latest.current = session;
  const key = session && `${session.harness}:${session.id}`;
  // Polls replace the session objects, so only the key decides when to reopen.
  useEffect(() => {
    const target = latest.current;
    if (!target) return;
    let cancelled = false;
    let current: OpenedRun | undefined;
    ports.open(target).then((o) => {
      if (cancelled) return o.close();
      current = o;
      setOpened(o);
    });
    return () => {
      cancelled = true;
      current?.close();
      setOpened(undefined);
    };
  }, [ports, key]);
  return opened;
};

const useAssets = (ports: UiPorts, cwd: string | undefined) => {
  const [opened, setOpened] = useState<OpenedAssets>();
  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    let current: OpenedAssets | undefined;
    ports.openAssets(cwd).then((o) => {
      if (cancelled) return o.close();
      current = o;
      setOpened(o);
    });
    return () => {
      cancelled = true;
      current?.close();
      setOpened(undefined);
    };
  }, [ports, cwd]);
  return opened;
};

// One shared array: a fresh one per read would look like a change every time.
const NO_ASSETS: readonly Asset[] = [];
const none: Store<readonly Asset[]> = {
  get: () => NO_ASSETS,
  subscribe: () => () => {},
};

// Owns selection, zoom and keys; the rest is presentation.
export const DashboardPage = ({
  ports,
  keys,
}: {
  ports: UiPorts;
  keys: Keys;
}) => {
  const size = useWindowSize();
  const sessions = useStore(ports.sessions);
  const [pickedKey, setPickedKey] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const groups = useMemo(() => groupByDirectory(sessions), [sessions]);
  const ordered = useMemo(() => groups.flatMap((g) => g.sessions), [groups]);
  // Selection is by identity, so a session moving up the list doesn't change it.
  const selected = ordered.find((s) => keyOf(s) === pickedKey) ?? ordered[0];
  const position = selected ? ordered.indexOf(selected) + 1 : 0;
  const opened = useOpened(ports, selected);
  const assets = useStore(useAssets(ports, selected?.cwd)?.assets ?? none);
  const many = ordered.length > 1;
  const metrics = responsive(size, zoom, many);

  const nav = useRef({ groups, selected });
  nav.current = { groups, selected };
  const go = (by: Move) => {
    const next = move(nav.current.groups, nav.current.selected, by);
    if (next) setPickedKey(keyOf(next));
  };

  useEffect(
    () =>
      keys.subscribe((key) => {
        if (key === "j" || key === "down") go("next");
        if (key === "k" || key === "up") go("previous");
        if (key === "]") go("nextGroup");
        if (key === "[") go("previousGroup");
        if (key === "+" || key === "=")
          setZoom((z) => clampZoom(z + ZOOM.step));
        if (key === "-") setZoom((z) => clampZoom(z - ZOOM.step));
        if (key === "0") setZoom(1);
      }),
    // `go` reads the latest selection from a ref.
    [keys],
  );

  return (
    <MetricsContext.Provider value={metrics}>
      <DashboardTemplate
        sidebar={
          many ? (
            <SessionList
              groups={groups}
              selected={selected}
              height={(size.height - 2 * metrics.pad) * 0.92}
            />
          ) : undefined
        }
        switcher={
          many ? (
            <SessionSwitcher
              current={selected}
              position={position}
              total={ordered.length}
            />
          ) : undefined
        }
      >
        {selected && opened ? (
          <RunPage
            key={keyOf(selected)}
            opened={opened}
            title={sessionTitle(selected)}
            cwd={selected.cwd}
            harness={selected.harness}
            assets={assets}
            size={size}
            zoom={zoom}
            keys={keys}
            sidebar={many}
            footer={<KeyHints />}
          />
        ) : (
          <PaneTemplate footer={<KeyHints />}>
            <Text tone="dim">
              {sessions.length ? "opening…" : "no running Claude Code sessions"}
            </Text>
          </PaneTemplate>
        )}
      </DashboardTemplate>
    </MetricsContext.Provider>
  );
};
