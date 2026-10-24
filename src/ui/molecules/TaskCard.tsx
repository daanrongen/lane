import type { Card as Task } from "@/domain/board.ts";
import { Dot } from "@/ui/atoms/Dot.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { taskCard } from "@/ui/lib/cards.ts";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import { duration } from "@/ui/lib/format.ts";
import { alpha } from "@/ui/lib/theme.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// One line: who, what, and when it got here.
export const TaskCard = ({
  task,
  owner,
  color,
}: {
  task: Task;
  owner: string;
  color: string;
}) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <Hover
      card={() => taskCard(task, owner)}
      accent={color}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: r.dot,
        padding: Math.round(r.dot / 2),
        paddingLeft: r.dot,
        borderRadius: 4,
        backgroundColor: alpha(theme.text, 0.06),
        overflow: "hidden",
      }}
    >
      <Dot color={color} faded={task.status === "done"} />
      <Text
        size="small"
        tone={task.status === "done" ? "dim" : "text"}
        style={{ flexGrow: 1, minWidth: 0 }}
      >
        {task.title}
      </Text>
      <Text size="small" tone="dim">
        {duration(task.since)}
      </Text>
    </Hover>
  );
};
