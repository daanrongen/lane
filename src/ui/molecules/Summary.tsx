import { Fragment } from "react";
import { Row } from "@/ui/atoms/Box.tsx";
import { Text } from "@/ui/atoms/Text.tsx";
import { useMetrics } from "@/ui/lib/context.ts";

// "ended · 5 agents · 25s", as under the reference title.
export const Summary = ({ items }: { items: readonly string[] }) => {
  const r = useMetrics();
  return (
    <Row gap={Math.round(r.dot)}>
      {items.map((item, i) => (
        <Fragment key={item}>
          {i > 0 ? <Text tone="dim">·</Text> : null}
          <Text tone="dim">{item}</Text>
        </Fragment>
      ))}
    </Row>
  );
};
