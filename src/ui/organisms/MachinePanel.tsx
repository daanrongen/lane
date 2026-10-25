import type { Floor } from "@/domain/floor.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { plural, tokens } from "@/ui/lib/format.ts";
import { harnessColor, INSIGHT_GLYPH } from "@/ui/lib/look.ts";

const Heading = ({ children }: { children: string }) => (
  <Text size="small" tone="dim">
    {children}
  </Text>
);

// The whole machine when no agent is selected: each harness's load and what looks wrong.
export const MachinePanel = ({
  floor,
  width,
}: {
  floor: Floor;
  width: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const names = new Map(floor.agents.map((a) => [a.ref, a.name]));
  const harnesses = [...new Set(floor.agents.map((a) => a.harness))].sort();
  const upNext = floor.agents.filter((a) => a.next).slice(0, 4);
  const col = r.compact ? width : Math.floor((width - r.pad) / 2);
  return (
    <Row
      gap={r.pad}
      align="flex-start"
      style={{
        flexDirection: r.compact ? "column" : "row",
      }}
    >
      <Column style={{ width: col }}>
        <Heading>HARNESSES</Heading>
        {harnesses.map((h) => {
          const mine = floor.agents.filter((a) => a.harness === h);
          const out = mine.reduce((n, a) => n + a.usage.output, 0);
          return (
            <Row key={h} gap={r.dot} style={{ height: r.row }}>
              <Text
                style={{
                  color: harnessColor(h, theme),
                  width: r.charWidth * 8,
                }}
              >
                {h}
              </Text>
              <Text size="small">{plural(mine.length, "agent")}</Text>
              <Text size="small" tone="dim">
                {`${mine.filter((a) => a.state === "working").length} working · ${tokens(out)} out`}
              </Text>
            </Row>
          );
        })}
        {upNext.length ? <Heading>UP NEXT</Heading> : null}
        {upNext.map((a) => (
          <Row key={a.ref} gap={r.dot} style={{ height: r.row }}>
            <Text size="small" style={{ width: r.charWidth * 8 }}>
              {a.name}
            </Text>
            <Text size="small" tone="dim" style={{ flexGrow: 1, minWidth: 0 }}>
              {a.next ?? ""}
            </Text>
          </Row>
        ))}
      </Column>
      <Column style={{ width: col }}>
        <Heading>WATCH</Heading>
        {floor.insights.length === 0 ? (
          <Text size="small" tone="dim">
            nothing looks wrong
          </Text>
        ) : null}
        {floor.insights.slice(0, 6).map((i) => (
          <Row
            key={`${i.kind}:${i.label}`}
            gap={r.dot}
            style={{ height: r.row }}
          >
            <Text size="small" style={{ color: theme.failed }}>
              {INSIGHT_GLYPH[i.kind]}
            </Text>
            <Text size="small">{i.kind}</Text>
            <Text size="small" tone="dim" style={{ flexGrow: 1, minWidth: 0 }}>
              {[
                i.kind === "collision" && baseName(i.label),
                i.agents.map((a) => names.get(a) ?? "").join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Row>
        ))}
      </Column>
    </Row>
  );
};
