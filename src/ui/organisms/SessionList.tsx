import type { Session } from "@/domain/session.ts";
import { Column } from "@/ui/atoms/Box.tsx";
import { useMetrics } from "@/ui/lib/context.ts";
import { SessionRow } from "@/ui/molecules/SessionRow.tsx";

export const SessionList = ({
  sessions,
  selected,
}: {
  sessions: readonly Session[];
  selected: number;
}) => {
  const r = useMetrics();
  return (
    <Column gap={Math.round(r.pad / 4)}>
      {sessions.map((s, i) => (
        <SessionRow key={s.id} session={s} selected={i === selected} />
      ))}
    </Column>
  );
};
