import { createTestRoot } from "@gpuix/react/testing";
import type { Layer } from "effect";
import { makeUiPorts } from "@/app/bridge.ts";
import { DemoLayer, LiveLayer } from "@/app/Layers.ts";
import { App } from "@/ui/App.tsx";
import { createKeys } from "@/ui/lib/keys.ts";
import type { Scheme } from "@/ui/lib/ports.ts";

// bun src/bin/shot.tsx <out.png> [demo|live] [dark|light] [width] [height] [hoverX hoverY]
// KEYS=down,n presses those keys before the shot.
const [out = "shot.png", source = "demo", scheme = "dark", w, h, hx, hy] =
  process.argv.slice(2);
const layers: Record<string, Layer.Layer<never, unknown>> = {
  demo: DemoLayer,
  live: LiveLayer,
};
const layer = layers[source];
if (!layer) throw new Error(`unknown source: ${source}`);

const ports = await makeUiPorts(layer as never);
const { keys, emit } = createKeys();
const fixed = {
  get: () => scheme as Scheme,
  subscribe: () => () => {},
};
const { render, renderer, unmount } = createTestRoot({
  width: Number(w ?? 1100),
  height: Number(h ?? 640),
});

render(<App ports={ports} scheme={fixed} keys={keys} />);
await Bun.sleep(4000);
for (const key of (process.env.KEYS ?? "").split(",").filter(Boolean)) {
  emit(key);
  await Bun.sleep(150);
}
await Bun.sleep(1500);
if (hx && hy) {
  renderer.nativeSimulateMouseMove(Number(hx), Number(hy));
  await Bun.sleep(600);
}
renderer.captureScreenshot(out);
unmount();
process.exit(0);
