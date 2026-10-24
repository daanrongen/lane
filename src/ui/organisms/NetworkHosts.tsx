import type { HostSummary } from "@/domain/network.ts";
import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { HostChip } from "@/ui/molecules/HostChip.tsx";

const SHOWN = 5;

// Where the agents reached outside the machine, busiest first.
export const NetworkHosts = ({ hosts }: { hosts: readonly HostSummary[] }) => {
  const r = useMetrics();
  const more = hosts.length - SHOWN;
  return (
    <Row gap={r.pad} style={{ overflow: "hidden" }}>
      <Text size="small" tone="dim">
        NET
      </Text>
      {hosts.length ? (
        hosts.slice(0, SHOWN).map((h) => <HostChip key={h.host} host={h} />)
      ) : (
        <Text size="small" tone="dim">
          none
        </Text>
      )}
      {more > 0 ? <Text size="small" tone="dim">{`+${more} more`}</Text> : null}
    </Row>
  );
};
