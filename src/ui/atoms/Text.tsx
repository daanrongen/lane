import type { StyleDesc } from "@gpuix/react";
import { useMetrics, useTheme } from "@/ui/lib/context.ts";
import type { Theme } from "@/ui/lib/theme.ts";

type Tone = keyof Pick<Theme, "text" | "dim" | "failed" | "running">;

interface TextProps {
  readonly size?: "title" | "body" | "small";
  readonly tone?: Tone;
  readonly style?: StyleDesc;
  readonly children: string;
}

// GPUI does not inherit colour, so every Text sets its own.
export const Text = ({
  size = "body",
  tone = "text",
  style,
  children,
}: TextProps) => {
  const r = useMetrics();
  const theme = useTheme();
  return (
    <text
      style={{
        fontSize: r.font[size],
        lineHeight: Math.round(r.font[size] * 1.25),
        color: theme[tone],
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        ...style,
      }}
    >
      {children}
    </text>
  );
};
