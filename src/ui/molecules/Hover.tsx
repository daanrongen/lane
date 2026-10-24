import type { StyleDesc } from "@gpuix/react";
import * as Tooltip from "@gpuix/react/tooltip";
import type { ReactNode } from "react";
import type { Card } from "@/ui/lib/cards.ts";
import { useTheme } from "@/ui/lib/context.ts";
import { InfoCard } from "@/ui/molecules/InfoCard.tsx";

// The card is built on demand, so thousands of bars cost nothing until hovered.
const Lazy = ({ card, accent }: { card: () => Card; accent: string }) => (
  <InfoCard card={card()} accent={accent} />
);

// The card anchors to `box` (where the area sits); `style` is how it looks inside.
export const Hover = ({
  card,
  accent,
  box,
  style,
  children,
}: {
  card: () => Card;
  accent: string;
  box?: StyleDesc;
  style?: StyleDesc;
  children?: ReactNode;
}) => {
  const theme = useTheme();
  return (
    <Tooltip.Root style={box}>
      <Tooltip.Trigger style={{ display: "flex", flexGrow: 1, ...style }}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content
        side="top"
        sideOffset={6}
        collisionPadding={8}
        style={{
          backgroundColor: theme.surface,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.line,
        }}
      >
        <Lazy card={card} accent={accent} />
      </Tooltip.Content>
    </Tooltip.Root>
  );
};
