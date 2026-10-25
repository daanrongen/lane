export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Responsive {
  readonly unit: number;
  // Narrow panes drop the sidebar and give its width to the timeline.
  readonly compact: boolean;
  readonly pad: number;
  readonly sidebar: number;
  readonly labels: number;
  readonly plotWidth: number;
  readonly pxPerSecond: number;
  readonly rowHeight: number;
  readonly barHeight: number;
  readonly contextHeight: number;
  readonly dot: number;
  readonly tickEvery: number;
  readonly charWidth: number;
  readonly font: {
    readonly title: number;
    readonly body: number;
    readonly small: number;
  };
}

const BASE = { width: 1100 };
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

// Layout scales with the pane width, text only with `zoom`.
// Height never resizes a component: short windows scroll instead.
export const responsive = (
  size: Size,
  zoom = 1,
  withSidebar = true,
): Responsive => {
  const u = clamp(size.width / BASE.width, 1, 1.5) * zoom;
  const px = (n: number) => Math.round(n * u);
  const text = (n: number) => Math.round(n * zoom);

  const compact = size.width < px(820);
  const sidebarShown = withSidebar && !compact;
  const pad = px(12);
  const sidebar = !sidebarShown
    ? 0
    : clamp(Math.round(size.width * 0.16), px(150), px(260));
  // Every section pads both sides, the sidebar included.
  const inner = size.width - sidebar - pad * (sidebarShown ? 4 : 2);
  const labels = clamp(Math.round(inner * 0.16), px(160), px(240));

  return {
    unit: u,
    compact,
    pad,
    sidebar,
    labels,
    plotWidth: Math.max(160, inner - labels),
    pxPerSecond: 2 * zoom,
    rowHeight: px(44),
    barHeight: px(22),
    contextHeight: px(130),
    dot: px(8),
    tickEvery: px(90),
    charWidth: text(11) * 0.6,
    font: { title: text(17), body: text(13), small: text(11) },
  };
};
