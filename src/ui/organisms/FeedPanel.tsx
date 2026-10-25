import type { FeedItem, Floor } from "@/domain/floor.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { harnessColor } from "@/ui/lib/look.ts";

const SHOWN = 10;

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
  now,
  width,
}: {
  floor: Floor;
  now: number;
  width: number;
}) => {
  const r = useMetrics();
  const agents = new Map(floor.agents.map((a) => [a.ref, a]));
  return (
    <Column style={{ width, paddingLeft: r.dot }}>
      <Row style={{ height: r.row }}>
        <Text size="small" tone="dim">
          FEED
        </Text>
      </Row>
      {floor.feed.slice(0, SHOWN).map((item) => {
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
