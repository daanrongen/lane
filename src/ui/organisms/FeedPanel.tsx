import { Button } from "@gpuix/react";
import type { FeedItem, Floor } from "@/domain/floor.ts";
import type { AgentRef } from "@/domain/ids.ts";
import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { about, histogram, type Lens, whatName } from "@/ui/lib/lens.ts";
import { harnessColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

const SHOWN = 10;
const SLICES = 24;

const Histogram = ({
  items,
  now,
  width,
  during,
  onPick,
}: {
  items: readonly FeedItem[];
  now: number;
  width: number;
  during?: Lens["during"];
  onPick: (during: Lens["during"]) => void;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const bins = histogram(items, now, SLICES);
  const top = Math.max(1, ...bins.map((b) => b.count));
  const slot = width / SLICES;
  return (
    <Row style={{ height: r.row, alignItems: "flex-end" }}>
      {bins.map((b) => {
        const on = during?.[0] === b.from;
        return (
          <Button
            key={b.from}
            onClick={() => onPick(on ? undefined : [b.from, b.to])}
            style={{
              width: Math.max(1, slot - 2),
              marginRight: 2,
              height: r.row,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <Box
              style={{
                width: "100%",
                height: Math.max(
                  b.count > 0 ? 2 : 0,
                  Math.round((b.count / top) * r.row),
                ),
                backgroundColor: on ? theme.text : alpha(theme.dim, 0.7),
              }}
            />
          </Button>
        );
      })}
    </Row>
  );
};

const Line = ({
  item,
  who,
  harness,
  now,
  mine,
}: {
  // False when another agent is selected, so this row recedes.
  mine: boolean;
  item: FeedItem;
  who: string;
  harness: string;
  now: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const bad = item.status === "failed" || item.status === "denied";
  return (
    <Row gap={r.dot} style={{ height: r.row }}>
      <Text size="small" tone="dim" style={{ width: r.charWidth * 6 }}>
        {duration((now - item.at) / 1000)}
      </Text>
      <Dot color={harnessColor(harness, theme)} />
      <Text size="small" style={{ width: r.charWidth * 14 }}>
        {who}
      </Text>
      <Text size="small" tone="dim" style={{ width: r.charWidth * 6 }}>
        {item.kind}
      </Text>
      <Text
        size="small"
        tone={bad ? "failed" : mine ? "text" : "dim"}
        style={{ flexGrow: 1, minWidth: 0 }}
      >
        {item.label}
      </Text>
    </Row>
  );
};

// What every agent did most recently, newest first.
export const FeedPanel = ({
  floor,
  items,
  lens,
  now,
  width,
  onLens,
  selected,
}: {
  selected?: AgentRef;
  floor: Floor;
  items: readonly FeedItem[];
  lens?: Lens;
  now: number;
  width: number;
  onLens: (lens: Lens | undefined) => void;
}) => {
  const r = useMetrics();
  const agents = new Map(floor.agents.map((a) => [a.ref, a]));
  return (
    <Column style={{ width }}>
      <Row style={{ height: r.row }}>
        <Text size="small" tone="dim">
          FEED
        </Text>
        {lens ? (
          <Button
            onClick={() => onLens(undefined)}
            style={{ paddingLeft: r.dot, height: r.row }}
          >
            <Text size="small">
              {`${[
                lens.what && whatName(lens.what),
                lens.during && `${duration((now - lens.during[0]) / 1000)} ago`,
              ]
                .filter(Boolean)
                .join(" · ")} ×`}
            </Text>
          </Button>
        ) : null}
      </Row>
      <Histogram
        items={about(floor, lens?.what)}
        now={now}
        width={width}
        during={lens?.during}
        onPick={(during) => onLens({ ...lens, during })}
      />
      {items.length === 0 ? (
        <Text size="small" tone="dim">
          nothing matches
        </Text>
      ) : null}
      {items.slice(0, SHOWN).map((item) => {
        const a = agents.get(item.agent);
        return (
          <Line
            key={`${item.agent}:${item.at}:${item.label}`}
            item={item}
            who={a?.name ?? ""}
            harness={a?.harness ?? ""}
            now={now}
            mine={!selected || item.agent === selected}
          />
        );
      })}
    </Column>
  );
};
