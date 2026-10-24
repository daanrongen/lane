import type { StyleDesc } from "@gpuix/react";
import type { ReactNode } from "react";

interface BoxProps {
  readonly style?: StyleDesc;
  readonly children?: ReactNode;
}

// gpuix only honours flex properties on `display: "flex"`.
export const Box = ({ style, children }: BoxProps) => (
  <div style={{ display: "flex", ...style }}>{children}</div>
);

interface StackProps extends BoxProps {
  readonly gap?: number;
  readonly align?: "flex-start" | "center" | "flex-end" | "stretch";
  readonly justify?: "flex-start" | "center" | "flex-end" | "space-between";
}

export const Row = ({
  gap,
  align = "center",
  justify,
  style,
  children,
}: StackProps) => (
  <Box
    style={{
      flexDirection: "row",
      alignItems: align,
      justifyContent: justify,
      gap,
      ...style,
    }}
  >
    {children}
  </Box>
);

export const Column = ({
  gap,
  align,
  justify,
  style,
  children,
}: StackProps) => (
  <Box
    style={{
      flexDirection: "column",
      alignItems: align,
      justifyContent: justify,
      gap,
      ...style,
    }}
  >
    {children}
  </Box>
);
