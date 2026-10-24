import type { SkillUse } from "@/domain/run.ts";
import { skillKey } from "@/domain/skills.ts";
import { skillMarkCard } from "@/ui/lib/cards.ts";
import { useCatalog } from "@/ui/lib/context.ts";
import type { Mark } from "@/ui/lib/layout.ts";
import { describeSkill } from "@/ui/lib/usageRows.ts";
import { Hover } from "@/ui/molecules/Hover.tsx";

// A solid square on the bar's lower edge: a skill was invoked here.
export const SkillMark = ({
  mark,
  color,
}: {
  mark: Mark<SkillUse>;
  color: string;
}) => {
  const catalog = useCatalog();
  const first = mark.items[0];
  return (
    <Hover
      card={() =>
        skillMarkCard(
          mark.items,
          first ? describeSkill(catalog, skillKey(first.name)) : undefined,
        )
      }
      accent={color}
      box={{
        position: "absolute",
        left: mark.x,
        top: mark.y,
        width: mark.width,
        height: mark.height,
      }}
      style={{ height: "100%", borderRadius: 2, backgroundColor: color }}
    />
  );
};
