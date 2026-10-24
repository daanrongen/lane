import type { ReactNode } from "react";
import { Box, Column } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

// A fixed top bar, a scrolling main view, a fixed bottom bar; all pad the same.
export const PaneTemplate = ({
  header,
  footer,
  children,
}: {
  header?: ReactNode;
  footer: ReactNode;
  children?: ReactNode;
}) => {
  const r = useMetrics();
  return (
    <Column style={{ flexGrow: 1, minHeight: 0 }}>
      {header ? (
        <Box style={{ flexShrink: 0, padding: r.pad }}>{header}</Box>
      ) : null}
      <Box
        style={{
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          overflowY: "scroll",
          padding: r.pad,
        }}
      >
        <Column gap={r.pad} style={{ flexShrink: 0 }}>
          {children}
        </Column>
      </Box>
      <Box style={{ flexShrink: 0, padding: r.pad }}>{footer}</Box>
    </Column>
  );
};
