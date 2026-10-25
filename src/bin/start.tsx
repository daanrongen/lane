import { render } from "@gpuix/react";
import type { Layer } from "effect";
import {
  answerAppearanceQuery,
  watchScheme,
} from "@/adapters/macos/appearance.ts";
import { makeUiPorts } from "@/app/bridge.ts";
import type { Fleet } from "@/app/Fleet.ts";
import type { SessionsStore } from "@/app/SessionsStore.ts";
import { answerCli, resolveMode } from "@/bin/cli.ts";
import type { Assets } from "@/ports/Assets.ts";
import type { Harnesses } from "@/ports/Harness.ts";
import { App } from "@/ui/App.tsx";
import { createKeys } from "@/ui/lib/keys.ts";

// Entrypoints differ only in the layer they provide.
export const start = async (
  layer: Layer.Layer<SessionsStore | Harnesses | Assets | Fleet, unknown>,
) => {
  answerCli();
  answerAppearanceQuery();
  const ports = await makeUiPorts(layer);
  const { keys, emit } = createKeys();
  const scheme = await watchScheme();

  render(<App ports={ports} scheme={scheme} keys={keys} />, {
    title: "Lane",
    appName: "Lane",
    terminal: resolveMode(process.argv.slice(2), process.env) === "terminal",
    onKeyDown: (event) => {
      if (event.key === "q") process.exit(0);
      if (event.key) emit(event.key);
    },
  });
};
