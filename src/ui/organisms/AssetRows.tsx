import type { Asset } from "@/domain/assets.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { assetRows } from "@/ui/lib/assetRows.ts";
import { useMetrics } from "@/ui/lib/context.ts";
import { AssetChip } from "@/ui/molecules/AssetChip.tsx";

// What is set up for the agents: config, skills, mcp servers and models, by owner.
export const AssetRows = ({ assets }: { assets: readonly Asset[] }) => {
  const r = useMetrics();
  const rows = assetRows(assets);
  return (
    <Column gap={Math.round(r.dot / 2)}>
      {rows.map((row) => (
        <Row key={row.title} gap={r.pad} style={{ overflow: "hidden" }}>
          <Box title={row.title} />
          {row.chips.map((chip) => (
            <AssetChip key={chip.label} chip={chip} />
          ))}
        </Row>
      ))}
    </Column>
  );
};

const Box = ({ title }: { title: string }) => {
  const r = useMetrics();
  return (
    <div style={{ display: "flex", width: Math.round(r.unit * 52) }}>
      <Text size="small" tone="dim">
        {title}
      </Text>
    </div>
  );
};
