import { createContext, useContext } from "react";
import { type Responsive, responsive } from "@/ui/lib/responsive.ts";
import { type Theme, themeDark } from "@/ui/lib/theme.ts";

export const ThemeContext = createContext<Theme>(themeDark);
export const MetricsContext = createContext<Responsive>(
  responsive({ width: 1100, height: 640 }, 0),
);

export const useTheme = () => useContext(ThemeContext);
export const useMetrics = () => useContext(MetricsContext);
