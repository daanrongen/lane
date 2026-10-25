import { useWindowSize } from "@gpuix/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentRef } from "@/domain/ids.ts";
import { Box, Column } from "@/ui/atoms/Box.tsx";
import { MetricsContext, useTheme } from "@/ui/lib/context.ts";
import { groups, order, step, stepAttention } from "@/ui/lib/fleet.ts";
import { useNow } from "@/ui/lib/hooks/useNow.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import type { Keys, UiPorts } from "@/ui/lib/ports.ts";
import { responsive } from "@/ui/lib/responsive.ts";
import { AttentionStrip } from "@/ui/organisms/AttentionStrip.tsx";
import { ControlsBar } from "@/ui/organisms/ControlsBar.tsx";
import { FleetTable } from "@/ui/organisms/FleetTable.tsx";
import { TopBar } from "@/ui/organisms/TopBar.tsx";
import { TreePanel } from "@/ui/organisms/TreePanel.tsx";
import { PaneTemplate } from "@/ui/templates/PaneTemplate.tsx";

const SPANS = [60, 120, 300, 600, 1800, 3600];

// The whole machine in one view: owns selection and keys, the rest is presentation.
export const FloorPage = ({ ports, keys }: { ports: UiPorts; keys: Keys }) => {
  const size = useWindowSize();
  const floor = useStore(ports.floor);
  const now = useNow(1000);
  const [picked, setPicked] = useState<AgentRef>();
  const [span, setSpan] = useState(300);
  const r = responsive(size);
  const theme = useTheme();

  const total = size.width - r.pad * 2;
  const fleetWidth = r.compact ? total : Math.round(total * 0.66);

  const gs = useMemo(() => groups(floor), [floor]);
  const agents = useMemo(() => order(gs), [gs]);
  // Selection is by identity, and goes when the agent does.
  const selected = agents.find((a) => a.ref === picked)?.ref;

  const notes = useMemo(
    () =>
      new Map(floor.attention.map((a) => [a.agent, `${a.reason}: ${a.label}`])),
    [floor.attention],
  );

  const latest = useRef({ floor, agents, selected });
  latest.current = { floor, agents, selected };
  useEffect(
    () =>
      keys.subscribe((key) => {
        const { floor, agents, selected } = latest.current;
        const go = (to: { ref: AgentRef } | undefined) =>
          to && setPicked(to.ref);
        if (key === "down") go(step(agents, selected, 1));
        if (key === "up") go(step(agents, selected, -1));
        if (key === "n") go(stepAttention(floor, agents, selected, 1));
        if (key === "N") go(stepAttention(floor, agents, selected, -1));
        if (key === "escape") setPicked(undefined);
        if (key === "+" || key === "=")
          setSpan((s) => SPANS[Math.max(0, SPANS.indexOf(s) - 1)] ?? s);
        if (key === "-")
          setSpan(
            (s) => SPANS[Math.min(SPANS.length - 1, SPANS.indexOf(s) + 1)] ?? s,
          );
      }),
    [keys],
  );

  return (
    <MetricsContext.Provider value={r}>
      <Column
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: theme.background,
        }}
      >
        <PaneTemplate
          header={<TopBar floor={floor} />}
          footer={<ControlsBar selected={selected !== undefined} />}
        >
          <AttentionStrip floor={floor} now={now} onSelect={setPicked} />
          <Box
            style={{
              flexDirection: r.compact ? "column" : "row",
              alignItems: "flex-start",
              gap: r.pad,
            }}
          >
            <FleetTable
              groups={gs}
              now={now}
              span={span}
              width={fleetWidth}
              selected={selected}
              onSelect={setPicked}
              notes={notes}
            />
            <TreePanel
              floor={floor}
              now={now}
              width={r.compact ? total : total - fleetWidth - r.pad}
              selected={selected}
            />
          </Box>
        </PaneTemplate>
      </Column>
    </MetricsContext.Provider>
  );
};
