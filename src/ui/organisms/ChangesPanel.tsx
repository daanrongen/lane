import { useMemo } from "react";
import type { Floor } from "@/domain/floor.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { changes } from "@/ui/lib/changes.ts";
import { useMetrics } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";

const SHOWN = 10;

// Files changed across agents, with a mark where two agents have met on one.
export const ChangesPanel = ({
  floor,
  now,
  width,
}: {
  floor: Floor;
  now: number;
  width: number;
}) => {
  const r = useMetrics();
  const rows = useMemo(() => changes(floor), [floor]);
  const names = new Map(floor.agents.map((a) => [a.ref, a.name]));
  return (
    <Column style={{ width }}>
      <Row style={{ height: r.row }}>
        <Text size="small" tone="dim">
          CHANGES
        </Text>
      </Row>
      {rows.length === 0 ? (
        <Text size="small" tone="dim">
          nothing edited yet
        </Text>
      ) : null}
      {rows.slice(0, SHOWN).map((c) => (
        <Row key={c.path} gap={r.dot} style={{ height: r.row }}>
          <Text size="small" tone="dim" style={{ width: r.charWidth * 6 }}>
            {duration((now - c.last) / 1000)}
          </Text>
          <Text
            size="small"
            tone={c.collided ? "failed" : "text"}
            style={{ flexGrow: 1, minWidth: 0 }}
          >
            {c.short}
          </Text>
          <Text size="small" tone="dim">
            {`${c.agents.map((a) => names.get(a) ?? "").join(", ")} · ${c.edits}`}
          </Text>
          <Text size="small" tone="failed">
            {c.collided ? "⚠" : ""}
          </Text>
        </Row>
      ))}
    </Column>
  );
};
