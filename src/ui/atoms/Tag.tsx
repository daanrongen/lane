import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { alpha } from "@/ui/lib/theme.ts";

// A small outlined label, tinted by `color`.
export const Tag = ({
  color,
  children,
}: {
  color: string;
  children: string;
}) => {
  const r = useMetrics();
  return (
    <div
      style={{
        display: "flex",
        paddingLeft: r.dot / 2,
        paddingRight: r.dot / 2,
        borderRadius: 4,
        backgroundColor: alpha(color, 0.16),
      }}
    >
      <Text size="small" style={{ color }}>
        {children}
      </Text>
    </div>
  );
};
