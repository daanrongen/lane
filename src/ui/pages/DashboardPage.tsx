import { useWindowSize } from "@gpuix/react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@/domain/session.ts";
import { Box } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { MetricsContext } from "@/ui/lib/context.ts";
import { sessionTitle } from "@/ui/lib/format.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import type { Keys, OpenedRun, UiPorts } from "@/ui/lib/ports.ts";
import { responsive } from "@/ui/lib/responsive.ts";
import { KeyHints } from "@/ui/organisms/KeyHints.tsx";
import { SessionList } from "@/ui/organisms/SessionList.tsx";
import { SessionSwitcher } from "@/ui/organisms/SessionSwitcher.tsx";
import { RunPage } from "@/ui/pages/RunPage.tsx";
import { DashboardTemplate } from "@/ui/templates/DashboardTemplate.tsx";

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
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const last = Math.max(0, sessions.length - 1);
  const current = Math.min(index, last);
  const selected = sessions[current];
  const opened = useOpened(ports, selected);
  const many = sessions.length > 1;

  useEffect(
    () =>
      keys.subscribe((key) => {
        if (key === "j" || key === "down")
          setIndex((i) => Math.min(i + 1, last));
        if (key === "k" || key === "up") setIndex((i) => Math.max(i - 1, 0));
        if (key === "+" || key === "=")
          setZoom((z) => clampZoom(z + ZOOM.step));
        if (key === "-") setZoom((z) => clampZoom(z - ZOOM.step));
        if (key === "0") setZoom(1);
      }),
    [keys, last],
  );

  return (
    <MetricsContext.Provider value={responsive(size, 0, zoom, many)}>
      <DashboardTemplate
        sidebar={
          many ? (
            <SessionList sessions={sessions} selected={current} />
          ) : undefined
        }
        switcher={
          many ? (
            <SessionSwitcher sessions={sessions} selected={current} />
          ) : undefined
        }
        footer={<KeyHints />}
      >
        {selected && opened ? (
          <RunPage
            key={selected.id}
            opened={opened}
            title={sessionTitle(selected)}
            cwd={selected.cwd}
            size={size}
            zoom={zoom}
            keys={keys}
            sidebar={many}
          />
        ) : (
          <Box style={{ flexGrow: 1 }}>
            <Text tone="dim">
              {sessions.length ? "opening…" : "no running Claude Code sessions"}
            </Text>
          </Box>
        )}
      </DashboardTemplate>
    </MetricsContext.Provider>
  );
};
