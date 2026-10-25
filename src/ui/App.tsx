import * as Tooltip from "@gpuix/react/tooltip";
import { ThemeContext } from "@/ui/lib/context.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import type { Keys, Scheme, Store, UiPorts } from "@/ui/lib/ports.ts";
import { themes } from "@/ui/lib/theme.ts";
import { FloorPage } from "@/ui/pages/FloorPage.tsx";

export const App = ({
  ports,
  scheme,
  keys,
}: {
  ports: UiPorts;
  scheme: Store<Scheme>;
  keys: Keys;
}) => (
  <ThemeContext.Provider value={themes[useStore(scheme)]}>
    <Tooltip.Provider delayDuration={120}>
      <FloorPage ports={ports} keys={keys} />
    </Tooltip.Provider>
  </ThemeContext.Provider>
);
