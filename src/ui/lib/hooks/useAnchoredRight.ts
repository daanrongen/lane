import { type PublicInstance, useGpuix } from "@gpuix/react";
import { useEffect, useRef } from "react";

// Keeps a horizontal scroller pinned to its right end while it grows, unless the user scrolled away.
export const useAnchoredRight = (content: number, viewport: number) => {
  const { renderer } = useGpuix();
  const ref = useRef<PublicInstance>(null);
  const end = useRef<number>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el || !renderer) return;
    const max = Math.max(0, content - viewport);
    const x = -(renderer.getScrollOffset?.(el.id)?.[0] ?? 0);
    if (end.current === undefined || x >= end.current - 2)
      renderer.scrollTo?.(el.id, -max, 0);
    end.current = max;
  }, [renderer, content, viewport]);

  return ref;
};
