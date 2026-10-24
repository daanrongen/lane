import type { ReactNode } from "react";
import { Box, Column, Row } from "@/ui/atoms/Box.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";

// Sidebar and pane on wide windows; on compact ones the switcher replaces the sidebar.
// With one session there is nothing to switch, so both are omitted.
export const DashboardTemplate = ({
  sidebar,
  switcher,
  children,
}: {
  sidebar?: ReactNode;
  switcher?: ReactNode;
  children: ReactNode;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Row
      align="stretch"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: theme.background,
      }}
    >
      {r.compact || !sidebar ? null : (
        <Box
          style={{
            width: r.sidebar + r.pad * 2,
            flexShrink: 0,
            padding: r.pad,
            overflow: "hidden",
          }}
        >
          {sidebar}
        </Box>
      )}
      <Column style={{ flexGrow: 1, minWidth: 0, overflow: "hidden" }}>
        {r.compact && switcher ? (
          <Box style={{ padding: r.pad, paddingBottom: 0 }}>{switcher}</Box>
        ) : null}
        {children}
      </Column>
    </Row>
  );
};
