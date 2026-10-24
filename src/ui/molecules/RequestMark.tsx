import type { Request } from "@/domain/run.ts";
import { requestsCard } from "@/ui/lib/cards.ts";
import { useTheme } from "@/ui/lib/context.ts";
import type { Mark } from "@/ui/lib/layout.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A ring on the bar edge: the agent reached outside the machine here.
export const RequestMark = ({
  mark,
  color,
}: {
  mark: Mark<Request>;
  color: string;
}) => {
  const theme = useTheme();
  return (
    <Hover
      card={() => requestsCard(mark.items)}
      accent={color}
      box={{
        position: "absolute",
        left: mark.x,
        top: mark.y,
        width: mark.width,
        height: mark.height,
      }}
      style={{
        height: "100%",
        borderRadius: mark.height / 2,
        backgroundColor: theme.background,
        borderWidth: 2,
        borderColor: color,
      }}
    />
  );
};
