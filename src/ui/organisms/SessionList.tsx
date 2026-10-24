import type { Session } from "@/domain/session.ts";
import { Column } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { useNow } from "@/ui/lib/hooks/useNow.ts";
import {
  type Group,
  keyOf,
  type NavItem,
  navItems,
  visible,
} from "@/ui/lib/sessionsNav.ts";
import { GroupHeading } from "@/ui/molecules/GroupHeading.tsx";
import { SessionRow } from "@/ui/molecules/SessionRow.tsx";

// Sessions under their directories; only the slice around the selection is drawn.
export const SessionList = ({
  groups,
  selected,
  height,
}: {
  groups: readonly Group[];
  selected: Session | undefined;
  height: number;
}) => {
  const r = useMetrics();
  const now = useNow(30_000);
  const items = navItems(groups);
  const isSelected = (s: Session) => selected && keyOf(s) === keyOf(selected);
  const focus = Math.max(
    0,
    items.findIndex((i) => i.kind === "session" && isSelected(i.session)),
  );
  const rowHeight = (i: NavItem) =>
    i.kind === "group" ? r.font.small * 2.4 : r.font.body * 3.2;
  return (
    <Column gap={Math.round(r.pad / 6)}>
      {visible(items, focus, height, rowHeight).map((item) =>
        item.kind === "group" ? (
          <GroupHeading key={`g:${item.group.cwd}`} group={item.group} />
        ) : (
          <SessionRow
            key={keyOf(item.session)}
            session={item.session}
            selected={isSelected(item.session) === true}
            now={now}
          />
        ),
      )}
    </Column>
  );
};
