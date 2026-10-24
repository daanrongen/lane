export interface Theme {
  readonly background: string;
  // Opaque raised surface, for hover cards.
  readonly surface: string;
  readonly text: string;
  readonly dim: string;
  readonly line: string;
  readonly failed: string;
  readonly running: string;
  readonly agents: readonly string[];
}

// Blends two #rrggbb colours; `t` is the share of `b`.
const mix = (a: string, b: string, t: number) => {
  const channel = (i: number) => {
    const x = Number.parseInt(a.slice(i, i + 2), 16);
    const y = Number.parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

interface Tokens {
  readonly background: string;
  readonly foreground: string;
  readonly selection: string;
  readonly red: string;
  readonly green: string;
  readonly yellow: string;
  readonly blue: string;
  readonly magenta: string;
  readonly cyan: string;
}

const fromTokens = (t: Tokens): Theme => ({
  background: t.background,
  surface: mix(t.background, t.foreground, 0.08),
  text: t.foreground,
  dim: mix(t.foreground, t.background, 0.45),
  line: t.selection,
  failed: t.red,
  running: t.green,
  agents: [t.blue, t.magenta, t.yellow, t.cyan, t.green],
});

// Tokens copied from ~/.config/ghostty/themes.
export const themeDark = fromTokens({
  background: "#282c33",
  foreground: "#acb2be",
  selection: "#3b414d",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
});

export const themeLight = fromTokens({
  background: "#fafafa",
  foreground: "#242529",
  selection: "#dcdcdd",
  red: "#de3e35",
  green: "#3f953a",
  yellow: "#d2b67c",
  blue: "#2f5af3",
  magenta: "#950095",
  cyan: "#0997b3",
});

export const themes = { dark: themeDark, light: themeLight } as const;

export const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")}`;

// The orchestrator is neutral; sub-agents cycle through the palette.
export const laneColor = (theme: Theme, lane: number) =>
  lane === 0
    ? theme.text
    : (theme.agents[(lane - 1) % theme.agents.length] ?? theme.text);
