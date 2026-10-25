import type { Thread } from "@/domain/thread.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { harnessColor } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

const SHOWN = 10;

// Earlier threads of a workspace, or of the machine, to pick one to replay.
export const HistoryPanel = ({
  threads,
  index,
  title,
  now,
  width,
}: {
  threads: readonly Thread[];
  index: number;
  title: string;
  now: number;
  width: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const from = Math.max(0, Math.min(index - SHOWN + 1, threads.length - SHOWN));
  return (
    <Column
      gap={Math.round(r.dot / 2)}
      style={{
        position: "absolute",
        top: r.pad * 3,
        left: r.pad * 2,
        width,
        padding: r.pad,
        backgroundColor: theme.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <Text>{`History · ${title}`}</Text>
      {threads.length === 0 ? (
        <Text size="small" tone="dim">
          nothing earlier
        </Text>
      ) : null}
      {threads.slice(from, from + SHOWN).map((t, i) => (
        <Row
          key={`${t.harness}:${t.id}`}
          gap={r.dot}
          style={{
            height: r.row,
            paddingLeft: r.dot,
            backgroundColor:
              from + i === index ? alpha(theme.text, 0.12) : undefined,
          }}
        >
          <Text size="small" tone="dim" style={{ width: r.charWidth * 8 }}>
            {`${duration((now - t.updatedAt) / 1000)} ago`}
          </Text>
          <Dot color={harnessColor(t.harness, theme)} />
          <Text size="small" style={{ flexGrow: 1, minWidth: 0 }}>
            {t.name ?? t.id}
          </Text>
          <Text size="small" tone="dim">
            {baseName(t.cwd)}
          </Text>
        </Row>
      ))}
      <Text size="small" tone="dim">
        ↑↓ pick enter replay esc close
      </Text>
    </Column>
  );
};
