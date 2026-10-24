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

const BASE: Size = { width: 1100, height: 640 };
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

// Text never shrinks below its baseline; large panes scale it up, `zoom` adjusts by hand.
export const responsive = (
  size: Size,
  lanes: number,
  zoom = 1,
  withSidebar = true,
): Responsive => {
  const u =
    clamp(
      Math.min(size.width / BASE.width, size.height / BASE.height),
      1,
      1.5,
    ) * zoom;
  const px = (n: number) => Math.round(n * u);

  const compact = size.width < px(820);
  const sidebarShown = withSidebar && !compact;
  const pad = px(16);
  const sidebar = !sidebarShown
    ? 0
    : clamp(Math.round(size.width * 0.16), px(150), px(260));
  const inner = size.width - sidebar - pad * (sidebarShown ? 3 : 2);
  const labels = clamp(Math.round(inner * 0.16), px(160), px(240));

  // Header, axis labels and footer take a fixed share; rows split the rest.
  const chrome = px(282) + px(100);
  const rowHeight = clamp(
    Math.floor((size.height - chrome) / Math.max(lanes, 1)),
    px(30),
    px(88),
  );

  // The context map takes some of the height the lanes leave, but stays small.
  const contextHeight = clamp(
    size.height - chrome - rowHeight * lanes + px(100),
    px(90),
    px(130),
  );

  return {
    unit: u,
    compact,
    pad,
    sidebar,
    labels,
    plotWidth: Math.max(160, inner - labels),
    rowHeight,
    barHeight: Math.max(10, Math.round(rowHeight * 0.42)),
    contextHeight,
    dot: px(8),
    tickEvery: px(90),
    charWidth: px(11) * 0.6,
    font: { title: px(17), body: px(13), small: px(11) },
  };
};
