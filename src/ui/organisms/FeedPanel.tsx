import { Button } from "@gpuix/react";
import type { FeedItem, Floor } from "@/domain/floor.ts";
import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { histogram, type Lens, lensName } from "@/ui/lib/lens.ts";
import { harnessColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

const SHOWN = 10;
const SLICES = 24;

const Histogram = ({
  items,
  now,
  width,
}: {
  items: readonly FeedItem[];
  now: number;
  width: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const bins = histogram(items, now, SLICES);
  const top = Math.max(1, ...bins);
  const slot = width / SLICES;
  return (
    <Row style={{ height: r.row, alignItems: "flex-end" }}>
      {bins.map((n, i) => (
        <Box
          // biome-ignore lint/suspicious/noArrayIndexKey: slices are positions
          key={i}
          style={{
            width: Math.max(1, slot - 2),
            marginRight: 2,
            height: Math.max(n > 0 ? 2 : 0, Math.round((n / top) * r.row)),
            backgroundColor: alpha(theme.dim, 0.7),
          }}
        />
      ))}
    </Row>
  );
};

const Line = ({
  item,
  who,
  harness,
  now,
}: {
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
        tone={bad ? "failed" : "text"}
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
  onClear,
}: {
  floor: Floor;
  items: readonly FeedItem[];
  lens?: Lens;
  now: number;
  width: number;
  onClear: () => void;
}) => {
  const r = useMetrics();
  const agents = new Map(floor.agents.map((a) => [a.ref, a]));
  return (
    <Column style={{ width, paddingLeft: r.dot }}>
      <Row style={{ height: r.row }}>
        <Text size="small" tone="dim">
          FEED
        </Text>
        {lens ? (
          <Button
            onClick={onClear}
            style={{ paddingLeft: r.dot, height: r.row }}
          >
            <Text size="small">{`${lensName(lens)} ×`}</Text>
          </Button>
        ) : null}
      </Row>
      <Histogram items={items} now={now} width={width - r.dot} />
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
          />
        );
      })}
    </Column>
  );
};
