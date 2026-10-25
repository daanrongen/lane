import { useWindowSize } from "@gpuix/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentRef } from "@/domain/ids.ts";
import type { Task } from "@/domain/task.ts";
import { Box, Column } from "@/ui/atoms/Box.tsx";
import { MetricsContext, useTheme } from "@/ui/lib/context.ts";
import { groups, order, step, stepAttention } from "@/ui/lib/fleet.ts";
import { useNow } from "@/ui/lib/hooks/useNow.ts";
import { useOpened } from "@/ui/lib/hooks/useOpened.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import { type Lens, lensed } from "@/ui/lib/lens.ts";
import { find } from "@/ui/lib/palette.ts";
import type { Keys, UiPorts } from "@/ui/lib/ports.ts";
import { responsive } from "@/ui/lib/responsive.ts";
import { AttentionStrip } from "@/ui/organisms/AttentionStrip.tsx";
import { ChangesPanel } from "@/ui/organisms/ChangesPanel.tsx";
import { ControlsBar } from "@/ui/organisms/ControlsBar.tsx";
import { DetailPanel } from "@/ui/organisms/DetailPanel.tsx";
import { FeedPanel } from "@/ui/organisms/FeedPanel.tsx";
import { FleetTable } from "@/ui/organisms/FleetTable.tsx";
import { Help } from "@/ui/organisms/Help.tsx";
import { Palette } from "@/ui/organisms/Palette.tsx";
import { TopBar } from "@/ui/organisms/TopBar.tsx";
import { TreePanel } from "@/ui/organisms/TreePanel.tsx";
import { PaneTemplate } from "@/ui/templates/PaneTemplate.tsx";

const NO_RUN = { get: () => undefined, subscribe: () => () => {} };
const NONE: readonly Task[] = [];
const NO_TASKS = { get: () => NONE, subscribe: () => () => {} };

const SPANS = [60, 120, 300, 600, 1800, 3600];

// The whole machine in one view: owns selection and keys, the rest is presentation.
export const FloorPage = ({ ports, keys }: { ports: UiPorts; keys: Keys }) => {
  const size = useWindowSize();
  const floor = useStore(ports.floor);
  const now = useNow(1000);
  const [picked, setPicked] = useState<AgentRef>();
  const [span, setSpan] = useState(300);
  const [help, setHelp] = useState(false);
  const [lens, setLens] = useState<Lens>();
  const [finding, setFinding] = useState<{ query: string; index: number }>();
  const r = responsive(size);
  const theme = useTheme();

  const total = size.width - r.pad * 2;
  const fleetWidth = r.compact ? total : Math.round(total * 0.66);

  const half = r.compact ? total : Math.floor((total - r.pad) / 2);

  const gs = useMemo(() => groups(floor), [floor]);
  const agents = useMemo(() => order(gs), [gs]);
  // Selection is by identity, and goes when the agent does.
  const selected = agents.find((a) => a.ref === picked)?.ref;

  const notes = useMemo(
    () =>
      new Map(floor.attention.map((a) => [a.agent, `${a.reason}: ${a.label}`])),
    [floor.attention],
  );

  const agent = agents.find((a) => a.ref === selected);
  const items = useMemo(() => lensed(floor, lens), [floor, lens]);
  const opened = useOpened(ports, agent?.harness, agent?.thread);
  const run = useStore(opened?.run ?? NO_RUN);
  const tasks = useStore(opened?.tasks ?? NO_TASKS);
  const setups = useStore(ports.setups);

  const found = useMemo(
    () => (finding ? find(floor, agents, finding.query) : []),
    [floor, agents, finding],
  );
  const latest = useRef({
    floor,
    agents,
    selected,
    finding,
    found,
    help,
    lens,
  });
  latest.current = { floor, agents, selected, finding, found, help, lens };
  useEffect(() => keys.typing(finding !== undefined), [keys, finding]);
  useEffect(
    () =>
      keys.subscribe((key) => {
        const { floor, agents, selected, finding, found, help, lens } =
          latest.current;
        if (finding) {
          const move = (by: number) =>
            setFinding({
              ...finding,
              index: Math.max(
                0,
                Math.min(found.length - 1, finding.index + by),
              ),
            });
          if (key === "escape") setFinding(undefined);
          if (key === "down") move(1);
          if (key === "up") move(-1);
          return;
        }
        if (help) {
          if (key === "escape" || key === "?") setHelp(false);
          return;
        }
        if (key === "?") setHelp(true);
        if (key === "/") setFinding({ query: "", index: 0 });
        const go = (to: { ref: AgentRef } | undefined) =>
          to && setPicked(to.ref);
        if (key === "down") go(step(agents, selected, 1));
        if (key === "up") go(step(agents, selected, -1));
        if (key === "n") go(stepAttention(floor, agents, selected, 1));
        if (key === "N") go(stepAttention(floor, agents, selected, -1));
        if (key === "escape") {
          if (lens) setLens(undefined);
          else setPicked(undefined);
        }
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
              runtimes={floor.runtimes}
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
              onPick={(ref) => setLens({ ref })}
            />
          </Box>
          <DetailPanel
            agent={agent}
            run={opened ? run : undefined}
            tasks={tasks}
            assets={agent ? (setups[agent.workspace] ?? []) : []}
            now={now}
            width={total}
          />
          <Box
            style={{
              flexDirection: r.compact ? "column" : "row",
              alignItems: "flex-start",
              gap: r.pad,
            }}
          >
            <FeedPanel
              floor={floor}
              items={items}
              lens={lens}
              now={now}
              width={half}
              onClear={() => setLens(undefined)}
            />
            <ChangesPanel floor={floor} now={now} width={half} />
          </Box>
        </PaneTemplate>
        {help ? (
          <Help width={Math.min(total, Math.round(r.charWidth * 70))} />
        ) : null}
        {finding ? (
          <Palette
            query={finding.query}
            results={found}
            index={finding.index}
            width={Math.min(total, Math.round(r.charWidth * 70))}
            onQuery={(query) => setFinding({ query, index: 0 })}
            onSubmit={() => {
              const hit = found[finding.index];
              if (hit && "agent" in hit) setPicked(hit.agent.ref);
              if (hit && "ref" in hit) setLens({ ref: hit.ref });
              if (hit && "text" in hit) setLens({ text: hit.text });
              setFinding(undefined);
            }}
          />
        ) : null}
      </Column>
    </MetricsContext.Provider>
  );
};
