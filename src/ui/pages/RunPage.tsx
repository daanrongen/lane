import { useEffect, useMemo, useState } from "react";
import { makeAxis } from "@/domain/axis.ts";
import { contextMap, contextUsed, laneWindow } from "@/domain/context.ts";
import { mcpServers } from "@/domain/mcp.ts";
import { hosts } from "@/domain/network.ts";
import { timeline } from "@/domain/timeline.ts";
import { Box, Row } from "@/ui/atoms/Box.tsx";
import { MetricsContext } from "@/ui/lib/context.ts";
import { useNow } from "@/ui/lib/hooks/useNow.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import { layout } from "@/ui/lib/layout.ts";
import type { Keys, OpenedRun } from "@/ui/lib/ports.ts";
import { responsive, type Size } from "@/ui/lib/responsive.ts";
import { ContextMap } from "@/ui/organisms/ContextMap.tsx";
import { Header } from "@/ui/organisms/Header.tsx";
import { Legend } from "@/ui/organisms/Legend.tsx";
import { McpServers } from "@/ui/organisms/McpServers.tsx";
import { NetworkHosts } from "@/ui/organisms/NetworkHosts.tsx";
import { TimelineChart } from "@/ui/organisms/TimelineChart.tsx";

const IDLE = { maxIdle: 60, collapsedTo: 2 };

// One session's run: header over a scrollable timeline chart.
export const RunPage = ({
  opened,
  title,
  cwd,
  harness,
  size,
  zoom,
  keys,
  sidebar,
}: {
  opened: OpenedRun;
  title: string;
  cwd: string;
  harness: string;
  size: Size;
  zoom: number;
  keys: Keys;
  sidebar: boolean;
}) => {
  const run = useStore(opened.run);
  const status = useStore(opened.status);
  const now = useNow(1000);
  const elapsed = Math.floor((now - run.startedAt) / 1000);

  const tl = useMemo(() => timeline(run, elapsed), [run, elapsed]);
  const r = responsive(size, tl.lanes.length, zoom, sidebar);
  const axis = useMemo(() => makeAxis(tl, IDLE), [tl]);
  const frame = useMemo(
    () =>
      layout(tl, axis, {
        plotWidth: r.plotWidth,
        rowHeight: r.rowHeight,
        barHeight: r.barHeight,
        tickEvery: r.tickEvery,
        charWidth: r.charWidth,
      }),
    [tl, axis, r.plotWidth, r.rowHeight, r.barHeight, r.tickEvery, r.charWidth],
  );

  const [picked, setPicked] = useState(0);
  const last = Math.max(0, tl.lanes.length - 1);
  useEffect(
    () =>
      keys.subscribe((key) => {
        if (key === "l" || key === "right") setPicked((i) => i + 1);
        if (key === "h" || key === "left") setPicked((i) => i - 1);
      }),
    [keys],
  );
  const lane = tl.lanes[Math.min(Math.max(picked, 0), last)];
  const map = useMemo(() => {
    const used = lane?.lastTurn ? contextUsed(lane.lastTurn.usage) : 0;
    return contextMap(
      run.context.filter((e) => e.agentId === lane?.agent.id),
      run.setups.findLast((s) => s.agentId === lane?.agent.id),
      used,
      lane ? laneWindow(lane) : 0,
    );
  }, [run.context, run.setups, lane]);
  const reached = useMemo(() => hosts(run.requests), [run.requests]);
  const servers = useMemo(
    () => mcpServers(run.setups, run.spans),
    [run.setups, run.spans],
  );

  return (
    <MetricsContext.Provider value={r}>
      <Header
        title={title}
        subtitle={cwd}
        harness={harness}
        status={status}
        timeline={tl}
      />
      <Box
        style={{
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          overflowY: "scroll",
        }}
      >
        <TimelineChart frame={frame} />
      </Box>
      <Row justify="space-between" gap={r.pad}>
        <Legend />
        <McpServers servers={servers} />
      </Row>
      <NetworkHosts hosts={reached} />
      {lane ? <ContextMap map={map} agent={lane.agent.name} /> : null}
    </MetricsContext.Provider>
  );
};
