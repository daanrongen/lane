import { useEffect, useRef, useState } from "react";
import { ThreadId } from "@/domain/ids.ts";
import { lastAt } from "@/domain/replay.ts";
import { emptyRun as blank } from "@/domain/run.ts";
import type { Thread } from "@/domain/thread.ts";
import { baseName } from "@/domain/workspace.ts";
import { Text } from "@/ui/atoms/Text.tsx";
import { duration } from "@/ui/lib/format.ts";
import { useOpened } from "@/ui/lib/hooks/useOpened.ts";
import { useStore } from "@/ui/lib/hooks/useStore.ts";
import type { Keys, UiPorts } from "@/ui/lib/ports.ts";
import type { Size } from "@/ui/lib/responsive.ts";
import { RunPage } from "@/ui/pages/RunPage.tsx";

const SPEEDS = { "1": 1, "2": 2, "3": 10 } as const;
const SEEK = 10;
const TICK = 100;

// A past run played back from its start, with a playhead.
export const ReplayPage = ({
  ports,
  thread,
  size,
  keys,
  onClose,
}: {
  ports: UiPorts;
  thread: Thread;
  size: Size;
  keys: Keys;
  onClose: () => void;
}) => {
  const opened = useOpened(ports, thread.harness, thread.id);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const end = useRef(0);
  const run = useStore(opened?.run ?? NO_RUN);
  end.current = lastAt(run);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setAt((t) => Math.min(end.current, t + (TICK / 1000) * speed)),
      TICK,
    );
    return () => clearInterval(id);
  }, [playing, speed]);

  useEffect(
    () =>
      keys.subscribe((key) => {
        if (key === "escape") onClose();
        if (key === " " || key === "space") setPlaying((p) => !p);
        if (key in SPEEDS) setSpeed(SPEEDS[key as keyof typeof SPEEDS]);
        if (key === "right") setAt((t) => Math.min(end.current, t + SEEK));
        if (key === "left") setAt((t) => Math.max(0, t - SEEK));
        if (key === "0") setAt(0);
      }),
    [keys, onClose],
  );

  if (!opened) return <Text tone="dim">opening</Text>;
  const done = at >= end.current;
  return (
    <RunPage
      opened={opened}
      title={thread.name ?? thread.id}
      cwd={baseName(thread.cwd)}
      harness={thread.harness}
      assets={[]}
      size={size}
      zoom={1}
      keys={keys}
      playhead={at}
      sidebar={false}
      footer={
        <Text size="small" tone="dim">
          {`${done ? "■" : playing ? "▶" : "❚❚"} ${speed}x  ${duration(at)} / ${duration(end.current)}   space pause   1 2 3 speed   ←→ seek   0 restart   h l agent   esc back`}
        </Text>
      }
    />
  );
};

const BLANK = blank(ThreadId(""), 0);
const NO_RUN = {
  get: () => BLANK,
  subscribe: () => () => {},
};
