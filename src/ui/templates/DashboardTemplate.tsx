import type { ReactNode } from "react";
import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";

// Sidebar and main on wide panes; on compact ones the switcher replaces the sidebar.
// With one session there is nothing to switch, so both are omitted.
export const DashboardTemplate = ({
  sidebar,
  switcher,
  footer,
  children,
}: {
  sidebar?: ReactNode;
  switcher?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Row
      align="stretch"
      gap={r.pad}
      style={{
        width: "100%",
        height: "100%",
        padding: r.pad,
        backgroundColor: theme.background,
      }}
    >
      {r.compact || !sidebar ? null : (
        <Box style={{ width: r.sidebar, flexShrink: 0, overflow: "hidden" }}>
          {sidebar}
        </Box>
      )}
      <Column
        gap={r.pad}
        style={{ flexGrow: 1, minWidth: 0, overflow: "hidden" }}
      >
        {r.compact ? (switcher ?? null) : null}
        <Column gap={r.pad} style={{ flexShrink: 1, minHeight: 0 }}>
          {children}
        </Column>
        {footer}
      </Column>
    </Row>
  );
};
