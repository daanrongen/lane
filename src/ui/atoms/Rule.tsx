import type { Box } from "@/ui/lib/layout.ts";

// A hairline or marker rectangle, absolutely placed.
export const Rule = ({
  box,
  color,
  round = false,
}: {
  box: Box;
  color: string;
  round?: boolean;
}) => (
  <div
    style={{
      position: "absolute",
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
      borderRadius: round ? box.height / 2 : 0,
      backgroundColor: color,
    }}
  />
);
