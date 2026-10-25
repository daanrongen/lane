import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import type { Card, Fact } from "@/ui/lib/cards.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { alpha } from "@/ui/lib/theme.ts";

const Facts = ({ facts }: { facts: readonly Fact[] }) => (
  <Column gap={2}>
    {facts.map(([label, value]) => (
      <Row key={label} justify="space-between" gap={16}>
        <Text size="small" tone="dim">
          {label}
        </Text>
        <Text size="small">{value}</Text>
      </Row>
    ))}
  </Column>
);

// A share of something, as a thin bar.
const Share = ({ ratio, color }: { ratio: number; color: string }) => {
  const theme = useTheme();
  return (
    <Box
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: alpha(theme.text, 0.12),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
          height: 4,
          backgroundColor: color,
        }}
      />
    </Box>
  );
};

export const InfoCard = ({ card, accent }: { card: Card; accent: string }) => {
  const r = useMetrics();
  return (
    <Column
      gap={Math.round(r.dot)}
      style={{
        width: Math.round(r.unit * 230),
        padding: r.pad,
      }}
    >
      <Column gap={2}>
        <Row gap={r.dot} style={{ overflow: "hidden" }}>
          <Dot color={accent} />
          <Text style={{ minWidth: 0 }}>{card.title}</Text>
        </Row>
        <Text size="small" tone="dim" style={{ minWidth: 0 }}>
          {card.subtitle}
        </Text>
      </Column>
      {card.ratio === undefined ? null : (
        <Share ratio={card.ratio} color={accent} />
      )}
      <Facts facts={card.facts} />
      {card.list.length ? <Facts facts={card.list} /> : null}
    </Column>
  );
};
