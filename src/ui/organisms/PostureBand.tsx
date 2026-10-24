import { Box, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import type { PostureBox } from "@/ui/lib/layout.ts";
import { PostureSegment } from "@/ui/molecules/PostureSegment.tsx";

// How the agent was allowed to act over the run: permission mode or approval policy.
export const PostureBand = ({ boxes }: { boxes: readonly PostureBox[] }) => {
  const r = useMetrics();
  return (
    <Row align="flex-start">
      <Box style={{ width: r.labels, flexShrink: 0, paddingLeft: r.dot }}>
        <Text size="small" tone="dim">
          mode
        </Text>
      </Box>
      <Box
        style={{
          position: "relative",
          width: r.plotWidth,
          height: Math.round(r.font.small * 1.5),
          flexShrink: 0,
        }}
      >
        {boxes.map((b) => (
          <PostureSegment key={`${b.span.kind}:${b.span.start}`} box={b} />
        ))}
      </Box>
    </Row>
  );
};
