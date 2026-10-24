import { useMetrics } from "@/ui/lib/context.ts";

export const Dot = ({
  color,
  faded = false,
}: {
  color: string;
  faded?: boolean;
}) => {
  const r = useMetrics();
  return (
    <div
      style={{
        width: r.dot,
        height: r.dot,
        flexShrink: 0,
        borderRadius: r.dot / 2,
        backgroundColor: color,
        opacity: faded ? 0.45 : 1,
      }}
    />
  );
};
