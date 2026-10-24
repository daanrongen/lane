import type { Board } from "@/domain/board.ts";
import type { AgentId } from "@/domain/ids.ts";
import type { Task } from "@/domain/task.ts";
import { Column, Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { TaskCard } from "@/ui/molecules/TaskCard.tsx";

export interface Owner {
  readonly name: string;
  readonly color: string;
}

const COLUMNS = [
  { key: "done", title: "Done" },
  { key: "doing", title: "Doing" },
  { key: "next", title: "Next" },
] as const;

const Lane = ({
  title,
  cards,
  owners,
  width,
  height,
}: {
  title: string;
  cards: readonly Task[];
  owners: ReadonlyMap<AgentId, Owner>;
  width: number;
  height: number;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  const cardHeight = Math.round(r.font.small * 1.25 + r.dot);
  const header = Math.round(r.font.small * 1.25 + r.dot);
  const room = Math.max(1, Math.floor((height - header) / (cardHeight + 3)));
  const shown = cards.length > room ? room - 1 : room;
  return (
    <Column
      gap={3}
      style={{
        width,
        height,
        padding: Math.round(r.dot / 2),
        borderRadius: 6,
        backgroundColor: alpha(theme.text, 0.04),
        overflow: "hidden",
      }}
    >
      <Row gap={r.dot}>
        <Text size="small">{title}</Text>
        <Text size="small" tone="dim">
          {String(cards.length)}
        </Text>
      </Row>
      {cards.slice(0, Math.max(0, shown)).map((card) => {
        const owner = owners.get(card.owner);
        return (
          <TaskCard
            key={card.id}
            task={card}
            owner={owner?.name ?? "agent"}
            color={owner?.color ?? theme.dim}
          />
        );
      })}
      {cards.length > shown ? (
        <Text size="small" tone="dim">{`+${cards.length - shown} more`}</Text>
      ) : null}
    </Column>
  );
};

// Done, doing, next: the tasks agents have finished, are working on, and have lined up.
export const TaskBoard = ({
  board,
  owners,
  width,
  height,
}: {
  board: Board;
  owners: ReadonlyMap<AgentId, Owner>;
  width: number;
  height: number;
}) => {
  const r = useMetrics();
  const gap = Math.round(r.dot / 2);
  const laneWidth = Math.floor((width - gap * 2) / 3);
  const total = board.done.length + board.doing.length + board.next.length;
  return (
    <Column gap={Math.round(r.pad / 2)} style={{ width }}>
      <Row justify="space-between">
        <Text>Tasks</Text>
        <Text tone="dim">
          {total ? `${board.done.length}/${total} done` : "nothing reported"}
        </Text>
      </Row>
      <Row gap={gap} align="flex-start">
        {COLUMNS.map((c) => (
          <Lane
            key={c.key}
            title={c.title}
            cards={board[c.key]}
            owners={owners}
            width={laneWidth}
            height={height}
          />
        ))}
      </Row>
    </Column>
  );
};
