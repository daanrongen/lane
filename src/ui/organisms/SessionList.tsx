import type { Project } from "@/domain/projects.ts";
import type { Session } from "@/domain/session.ts";
import { Column } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { useNow } from "@/ui/lib/hooks/useNow.ts";
import {
  keyOf,
  type NavItem,
  navItems,
  visible,
} from "@/ui/lib/sessionsNav.ts";
import { ProjectHeading } from "@/ui/molecules/ProjectHeading.tsx";
import { SessionRow } from "@/ui/molecules/SessionRow.tsx";

// Sessions under their projects; only the slice around the selection is drawn.
export const SessionList = ({
  groups,
  selected,
  height,
}: {
  groups: readonly Project[];
  selected: Session | undefined;
  height: number;
}) => {
  const r = useMetrics();
  const now = useNow(30_000);
  const items = navItems(groups);
  const focus = Math.max(
    0,
    items.findIndex(
      (i) =>
        i.kind === "session" &&
        selected &&
        keyOf(i.session) === keyOf(selected),
    ),
  );
  const rowHeight = (i: NavItem) =>
    i.kind === "project" ? r.font.small * 2.4 : r.font.body * 3.2;
  const shown = visible(items, focus, height, rowHeight);
  return (
    <Column gap={Math.round(r.pad / 6)}>
      {shown.map((item) =>
        item.kind === "project" ? (
          <ProjectHeading
            key={`p:${item.project.cwd}`}
            project={item.project}
          />
        ) : (
          <SessionRow
            key={keyOf(item.session)}
            session={item.session}
            selected={
              selected !== undefined && keyOf(item.session) === keyOf(selected)
            }
            now={now}
          />
        ),
      )}
    </Column>
  );
};
