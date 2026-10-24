import { createContext, useContext } from "react";
import type { Asset } from "@/domain/assets.ts";
import { type Responsive, responsive } from "@/ui/lib/responsive.ts";
import { type Theme, themeDark } from "@/ui/lib/theme.ts";

export const ThemeContext = createContext<Theme>(themeDark);
export const MetricsContext = createContext<Responsive>(
  responsive({ width: 1100, height: 640 }),
);

// What the machine has set up, used to explain what a session did, never to list it.
export const AssetsContext = createContext<readonly Asset[]>([]);

export const useTheme = () => useContext(ThemeContext);
export const useMetrics = () => useContext(MetricsContext);

export const useCatalog = () => useContext(AssetsContext);
