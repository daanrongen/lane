import { Box } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import type { PostureBox } from "@/ui/lib/layout.ts";
import { PostureSegment } from "@/ui/molecules/PostureSegment.tsx";

export const postureHeight = (small: number) => Math.round(small * 1.5);

export const PostureLabel = () => {
  const r = useMetrics();
  return (
    <Box style={{ paddingLeft: r.dot, height: postureHeight(r.font.small) }}>
      <Text size="small" tone="dim">
        mode
      </Text>
    </Box>
  );
};

// How the agent was allowed to act over the run: permission mode or approval policy.
export const PostureBand = ({
  boxes,
  width,
}: {
  boxes: readonly PostureBox[];
  width: number;
}) => {
  const r = useMetrics();
  return (
    <Box
      style={{
        position: "relative",
        width,
        height: postureHeight(r.font.small),
        flexShrink: 0,
      }}
    >
      {boxes.map((b) => (
        <PostureSegment key={`${b.span.kind}:${b.span.start}`} box={b} />
      ))}
    </Box>
  );
};
