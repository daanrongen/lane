import type { FeedItem, Floor } from "@/domain/floor.ts";
import { type Ref, refKey } from "@/domain/ref.ts";

// How a ref reads in a list.
export const refLabel = (r: Ref): string => {
  switch (r._tag) {
    case "File":
    case "Folder":
      return r.path;
    case "Host":
      return r.host;
    case "Mcp":
      return r.server;
    case "Skill":
      return r.name;
    case "Subject":
      return `${r.kind} ${r.id}`;
    case "Command":
      return r.program;
    case "Model":
      return r.id;
    case "Agent":
      return r.id;
  }
};

const covers = (r: Ref, t: Ref) =>
  r._tag === "Folder" && t._tag === "File"
    ? t.path.startsWith(`${r.path}/`)
    : refKey(r) === refKey(t);

// The recent acts that involve a ref: what touched it, or what a model or agent did.
export const touching = (floor: Floor, r: Ref): FeedItem[] => {
  if (r._tag === "Model") {
    const who = new Set(
      floor.agents.filter((a) => a.model === r.id).map((a) => a.ref),
    );
    return floor.feed.filter((i) => who.has(i.agent));
  }
  if (r._tag === "Agent") return floor.feed.filter((i) => i.agent === r.id);
  return floor.feed.filter((i) => i.touches.some((t) => covers(r, t)));
};

const FINDABLE = new Set([
  "File",
  "Host",
  "Mcp",
  "Skill",
  "Subject",
  "Command",
]);

// Every distinct thing the recent acts touched, and every model in use, with how often.
export const refsOf = (floor: Floor): { ref: Ref; count: number }[] => {
  const seen = new Map<string, { ref: Ref; count: number }>();
  const add = (ref: Ref) => {
    const hit = seen.get(refKey(ref));
    if (hit) hit.count++;
    else seen.set(refKey(ref), { ref, count: 1 });
  };
  for (const i of floor.feed) {
    for (const t of i.touches) if (FINDABLE.has(t._tag)) add(t);
  }
  for (const a of floor.agents)
    if (a.model) add({ _tag: "Model", id: a.model });
  return [...seen.values()].sort((a, b) => b.count - a.count);
};
