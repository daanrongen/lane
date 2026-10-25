import type { AgentView } from "@/domain/floor.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { harnessColor, stateLook } from "@/ui/lib/look.ts";
import { alpha } from "@/ui/lib/theme.ts";

const SHOWN = 8;

// Type to find any agent; Enter jumps to the highlighted one.
export const Palette = ({
  query,
  results,
  index,
  width,
  onQuery,
  onSubmit,
}: {
  query: string;
  results: readonly AgentView[];
  index: number;
  width: number;
  onQuery: (query: string) => void;
  onSubmit: () => void;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Column
      gap={Math.round(r.dot / 2)}
      style={{
        position: "absolute",
        top: r.pad * 3,
        left: Math.round((r.pad * 2 + 0) / 1),
        width,
        padding: r.pad,
        backgroundColor: theme.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: a gpuix input receives no keys without it
        autoFocus
        value={query}
        placeholder="find an agent by name, harness, state or workspace"
        onChange={(e) => onQuery(e.value ?? "")}
        onSubmit={onSubmit}
        style={{
          height: r.row,
          color: theme.text,
          fontSize: r.font.body,
        }}
      />
      {results.slice(0, SHOWN).map((a, i) => {
        const look = stateLook(a.state, theme);
        return (
          <Row
            key={a.ref}
            gap={r.dot}
            style={{
              height: r.row,
              paddingLeft: r.dot,
              backgroundColor:
                i === index ? alpha(theme.text, 0.12) : undefined,
            }}
          >
            <Text style={{ color: look.color }}>{look.glyph}</Text>
            <Text style={{ color: harnessColor(a.harness, theme) }}>
              {a.harness}
            </Text>
            <Text style={{ flexGrow: 1 }}>{a.name}</Text>
            <Text size="small" tone="dim">
              {baseName(a.workspace)}
            </Text>
          </Row>
        );
      })}
      {results.length === 0 ? (
        <Text size="small" tone="dim">
          nothing matches
        </Text>
      ) : null}
    </Column>
  );
};
