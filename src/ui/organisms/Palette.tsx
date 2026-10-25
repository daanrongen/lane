import { refLabel } from "@/domain/pivot.ts";
import { baseName } from "@/domain/workspace.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { harnessColor, stateLook } from "@/ui/lib/look.ts";
import type { Hit as PaletteHit } from "@/ui/lib/palette.ts";
import { alpha } from "@/ui/lib/theme.ts";

const SHOWN = 8;

const Hit = ({ hit }: { hit: PaletteHit }) => {
  const theme = useTheme();
  if ("agent" in hit) {
    const a = hit.agent;
    const look = stateLook(a.state, theme);
    return (
      <>
        <Text style={{ color: look.color }}>{look.glyph}</Text>
        <Text style={{ color: harnessColor(a.harness, theme) }}>
          {a.harness}
        </Text>
        <Text style={{ flexGrow: 1 }}>{a.name}</Text>
        <Text size="small" tone="dim">
          {baseName(a.workspace)}
        </Text>
      </>
    );
  }
  if ("ref" in hit) {
    return (
      <>
        <Text size="small" tone="dim" style={{ width: 60 }}>
          {hit.ref._tag.toLowerCase()}
        </Text>
        <Text style={{ flexGrow: 1, minWidth: 0 }}>{refLabel(hit.ref)}</Text>
        <Text size="small" tone="dim">
          {`${hit.count}`}
        </Text>
      </>
    );
  }
  return (
    <>
      <Text size="small" tone="dim" style={{ width: 60 }}>
        feed
      </Text>
      <Text>{`filter the feed by "${hit.text}"`}</Text>
    </>
  );
};

// Type to find an agent or anything agents touched; Enter picks the highlighted one.
export const Palette = ({
  query,
  results,
  index,
  width,
  onQuery,
  onSubmit,
}: {
  query: string;
  results: readonly PaletteHit[];
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
        placeholder="find an agent, file, host, MCP server, skill or model"
        onChange={(e) => onQuery(e.value ?? "")}
        onSubmit={onSubmit}
        style={{
          height: r.row,
          color: theme.text,
          fontSize: r.font.body,
        }}
      />
      {results.slice(0, SHOWN).map((hit, i) => (
        <Row
          key={"agent" in hit ? hit.agent.ref : JSON.stringify(hit)}
          gap={r.dot}
          style={{
            height: r.row,
            paddingLeft: r.dot,
            backgroundColor: i === index ? alpha(theme.text, 0.12) : undefined,
          }}
        >
          <Hit hit={hit} />
        </Row>
      ))}
      {results.length === 0 ? (
        <Text size="small" tone="dim">
          nothing matches
        </Text>
      ) : null}
    </Column>
  );
};
