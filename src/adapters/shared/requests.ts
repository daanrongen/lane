import type { RunEvent } from "@/domain/events.ts";
import type { AgentId } from "@/domain/ids.ts";
import { hostOf, type Target } from "@/domain/network.ts";

export const SEARCH_HOST = "web search";

export const requestEvents = (
  agentId: AgentId,
  at: number,
  via: string,
  targets: readonly Target[],
): RunEvent[] =>
  targets.map((t) => ({
    _tag: "RequestMade",
    request: { agentId, at, host: t.host, via, label: t.label },
  }));

export const fetchTarget = (url: string | undefined): Target[] => {
  const host = url ? hostOf(url) : undefined;
  return url && host ? [{ host, label: url }] : [];
};
