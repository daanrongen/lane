import type { Decoder } from "@/adapters/shared/decoder.ts";
import { arr, type Json, num, rec, str } from "@/adapters/shared/json.ts";
import { reasonOf } from "@/adapters/shared/reason.ts";
import {
  fetchTarget,
  requestEvents,
  SEARCH_HOST,
} from "@/adapters/shared/requests.ts";
import {
  IMAGE_TOKENS,
  imagesIn,
  sizeOf,
  tokensOf,
} from "@/adapters/shared/sizing.ts";
import type { RunEvent } from "@/domain/events.ts";
import { AgentId, SpanId } from "@/domain/ids.ts";
import { mcpName } from "@/domain/mcp.ts";
import { providerOf } from "@/domain/models.ts";
import { type Target, targetsOfCommand } from "@/domain/network.ts";
import type { Agent, Entry, Usage } from "@/domain/run.ts";

export interface Spawn {
  readonly agentId: AgentId;
  readonly name: string;
  readonly description: string;
}

export interface DecoderConfig {
  // Epoch ms of the run start; event times are seconds from here.
  readonly origin: number;
  readonly agentId: AgentId;
  // Announced on the first line; set for the root agent only.
  readonly self?: Agent;
  readonly spawns: (toolUseId: string) => Spawn | undefined;
}

const SPAWN_TOOLS = new Set(["Agent", "Task"]);

const labelOf = (name: string, input: Json | undefined) => {
  const raw =
    str(input?.description) ??
    str(input?.file_path) ??
    str(input?.pattern) ??
    str(input?.command) ??
    name;
  return raw.split("\n")[0]?.slice(0, 80) || name;
};

// Attachments that are logs of the setup, not content the model reads.
const NOT_CONTEXT = new Set(["prompt_snapshot", "deferred_tools_record"]);

// What a tool call reaches on the network, as far as its input shows.
const targetsOf = (name: string, input: Json | undefined): Target[] => {
  switch (name) {
    case "WebFetch":
      return fetchTarget(str(input?.url));
    case "WebSearch":
      return [{ host: SEARCH_HOST, label: str(input?.query) ?? "" }];
    case "Bash":
      return targetsOfCommand(str(input?.command) ?? "");
    default:
      return [];
  }
};

const FILE_TOOLS = new Set(["Read", "Edit", "Write", "NotebookEdit"]);

// Files are grouped by their last two directories.
const sourceOf = (
  name: string,
  input: Json | undefined,
): Pick<Entry, "kind" | "label"> => {
  const mcp = mcpName(name);
  if (mcp) return { kind: "Tool", label: `mcp · ${mcp.server}` };
  const path = str(input?.file_path);
  if (!FILE_TOOLS.has(name) || !path) return { kind: "Tool", label: name };
  const dir = path.split("/").slice(0, -1).slice(-2).join("/");
  return { kind: "File", label: `${dir}/` };
};

const usageOf = (u: Json | undefined): Usage => ({
  input: num(u?.input_tokens),
  output: num(u?.output_tokens),
  cacheRead: num(u?.cache_read_input_tokens),
  cacheWrite: num(u?.cache_creation_input_tokens),
});

// Unknown or malformed lines are ignored, never thrown on.
export const makeDecoder = (cfg: DecoderConfig): Decoder => {
  const { agentId } = cfg;
  const turns = new Set<string>();
  const ended = new Set<string>();
  const spans = new Map<string, boolean>(); // tool_use id -> closed
  const sources = new Map<string, Pick<Entry, "kind" | "label">>();
  let permission: string | undefined;
  let announced = false;
  let boundary: number | undefined;
  let last = 0;

  // Spawns whose sub-agent meta hasn't been seen yet: id -> the tool_use.
  const pending = new Map<string, { name: string; input?: Json; at: number }>();

  const added = (
    at: number,
    source: Pick<Entry, "kind" | "label">,
    chars: number,
  ): RunEvent[] =>
    chars > 0
      ? [
          {
            _tag: "ContextAdded",
            entry: { agentId, at, ...source, tokens: tokensOf(chars) },
          },
        ]
      : [];

  const message = (at: number, content: unknown): RunEvent[] =>
    added(at, { kind: "Message", label: "Messages" }, sizeOf(content));

  const spawned = (id: string, spawn: Spawn, at: number): RunEvent[] => [
    {
      _tag: "AgentSpawned",
      agent: { id: spawn.agentId, parentId: agentId, name: spawn.name },
      at,
    },
    {
      _tag: "SpanOpened",
      span: {
        _tag: "Waiting",
        id: SpanId(id),
        agentId,
        label: spawn.description,
        start: at,
        on: spawn.agentId,
      },
    },
  ];

  const called = (
    id: string,
    name: string,
    input: Json | undefined,
    at: number,
  ): RunEvent[] => {
    const mcp = mcpName(name);
    const base = {
      id: SpanId(id),
      agentId,
      label: labelOf(mcp?.tool ?? name, input),
      failed: false,
      start: at,
    };
    return [
      {
        _tag: "SpanOpened",
        span: mcp
          ? { ...base, _tag: "McpCall", ...mcp }
          : { ...base, _tag: "ToolCall", tool: name },
      },
    ];
  };

  // Once forced, an unresolved spawn degrades to a plain tool call.
  const resolve = (id: string, force: boolean): RunEvent[] => {
    const p = pending.get(id);
    if (!p) return [];
    const spawn = cfg.spawns(id);
    if (!spawn && !force) return [];
    pending.delete(id);
    return spawn ? spawned(id, spawn, p.at) : called(id, p.name, p.input, p.at);
  };

  const settle = (force: boolean): RunEvent[] =>
    [...pending.keys()].flatMap((id) => resolve(id, force));

  const toolUse = (b: Json, at: number): RunEvent[] => {
    const id = str(b.id);
    const name = str(b.name);
    if (!id || !name || spans.has(id)) return [];
    spans.set(id, false);

    const input = rec(b.input);
    const source = sourceOf(name, input);
    sources.set(id, source);
    const entry = [
      ...added(at, source, sizeOf(b.input)),
      ...requestEvents(agentId, at, name, targetsOf(name, input)),
      ...intents(name, input, at),
    ];
    if (!SPAWN_TOOLS.has(name))
      return [...entry, ...called(id, name, input, at)];
    pending.set(id, { name, input, at });
    return [...entry, ...resolve(id, false)];
  };

  // The tool calls that name a skill.
  const intents = (
    name: string,
    input: Json | undefined,
    at: number,
  ): RunEvent[] => {
    const skill = name === "Skill" ? str(input?.skill) : undefined;
    return skill
      ? [{ _tag: "SkillUsed", use: { agentId, at, name: skill, via: "tool" } }]
      : [];
  };

  const modeChanged = (value: string | undefined): RunEvent[] => {
    if (!value || value === permission) return [];
    permission = value;
    return [
      {
        _tag: "ModeChanged",
        change: { agentId, at: last, kind: "permission", value },
      },
    ];
  };

  // The snapshot sizes the system prompt and each tool definition.
  const setup = (a: Json | undefined, at: number): RunEvent[] => {
    const tools = arr(a?.tools);
    if (a?.type !== "prompt_snapshot" || tools.length === 0) return [];
    return [
      {
        _tag: "SetupReported",
        setup: {
          agentId,
          at,
          system: tokensOf(sizeOf(a.systemPrompt)),
          tools: tools.flatMap((t) => {
            const name = str(rec(t)?.name);
            return name
              ? [{ name, tokens: tokensOf(JSON.stringify(t).length) }]
              : [];
          }),
        },
      },
    ];
  };

  const reminder = (a: Json | undefined, at: number): RunEvent[] =>
    a && !NOT_CONTEXT.has(String(a.type))
      ? added(
          at,
          { kind: "Message", label: "Reminders" },
          JSON.stringify(a).length,
        )
      : [];

  const assistant = (line: Json, msg: Json, at: number): RunEvent[] => {
    const events: RunEvent[] = [];
    const id = str(msg.id);
    // Every content block is its own line and repeats the message usage.
    // Placeholder lines (interrupts, errors) carry no model and are not turns.
    if (id && !turns.has(id) && msg.model !== "<synthetic>") {
      turns.add(id);
      events.push({
        _tag: "TurnReported",
        turn: {
          agentId,
          at,
          model: str(msg.model),
          provider: providerOf(str(msg.model)),
          usage: usageOf(rec(msg.usage)),
        },
      });
    }
    for (const b of arr(msg.content)) {
      const block = rec(b);
      if (
        block?.type === "thinking" &&
        boundary !== undefined &&
        at > boundary
      ) {
        const spanId = SpanId(str(line.uuid) ?? `${id}:${at}`);
        events.push(
          {
            _tag: "SpanOpened",
            span: {
              _tag: "Thinking",
              id: spanId,
              agentId,
              label: "thinking",
              start: boundary,
            },
          },
          { _tag: "SpanClosed", spanId, at },
        );
      }
      if (block?.type === "text") events.push(...message(at, block.text));
      if (block?.type === "thinking") {
        const source = { kind: "Message", label: "Thinking" } as const;
        // The text is redacted; the signature grows with it.
        const chars = sizeOf(block.thinking) || sizeOf(block.signature) * 0.75;
        events.push(...added(at, source, chars));
      }
      if (block?.type === "tool_use") events.push(...toolUse(block, at));
    }
    // A final answer or a handback: sub-agents are done, the root is idle until the next prompt.
    const handback = arr(msg.content).some(
      (b) => rec(b)?.name === "SubagentHandback",
    );
    if (id && (msg.stop_reason === "end_turn" || handback) && !ended.has(id)) {
      ended.add(id);
      events.push({ _tag: "AgentFinished", agentId, at });
    }
    return events;
  };

  const user = (msg: Json, at: number): RunEvent[] =>
    (typeof msg.content === "string"
      ? [{ type: "text", text: msg.content }]
      : arr(msg.content)
    ).flatMap((b): RunEvent[] => {
      const block = rec(b);
      const id = str(block?.tool_use_id);
      if (block?.type === "text") return message(at, block.text);
      if (block?.type !== "tool_result" || !id || spans.get(id) !== false) {
        return [];
      }
      spans.set(id, true);
      const source = sources.get(id);
      return [
        ...(source ? added(at, source, sizeOf(block.content)) : []),
        ...added(
          at,
          { kind: "File", label: "Images" },
          IMAGE_TOKENS * 4 * imagesIn(block.content),
        ),
        ...resolve(id, true),
        {
          _tag: "SpanClosed",
          spanId: SpanId(id),
          at,
          failed: block?.is_error === true,
          reason:
            block?.is_error === true ? reasonOf(block.content) : undefined,
        },
      ];
    });

  return {
    push(raw) {
      const line = rec(raw);
      // Mode changes carry no timestamp.
      if (line?.type === "permission-mode") {
        return modeChanged(str(line.permissionMode));
      }
      const ts = Date.parse(str(line?.timestamp) ?? "");
      if (!line || Number.isNaN(ts)) return [];
      const at = (ts - cfg.origin) / 1000;
      const type = line.type;

      if (type === "system") {
        return line.subtype === "compact_boundary"
          ? [{ _tag: "ContextCompacted", agentId, at }]
          : [];
      }
      if (type === "attachment") {
        const attachment = rec(line.attachment);
        return [...setup(attachment, at), ...reminder(attachment, at)];
      }

      const msg = rec(line.message);
      if (!msg || (type !== "assistant" && type !== "user")) return [];

      const events: RunEvent[] = [];
      if (!announced && cfg.self) {
        events.push({ _tag: "AgentSpawned", agent: cfg.self, at });
      }
      announced = true;
      events.push(
        ...settle(false),
        ...(type === "assistant" ? assistant(line, msg, at) : user(msg, at)),
      );
      boundary = at;
      last = at;
      return events;
    },

    settle: () => settle(false),

    end() {
      const flushed = settle(true);
      const dangling = [...spans]
        .filter(([, closed]) => !closed)
        .map(
          ([id]): RunEvent => ({
            _tag: "SpanClosed",
            spanId: SpanId(id),
            at: last,
          }),
        );
      return [
        ...flushed,
        ...dangling,
        { _tag: "AgentFinished", agentId, at: last },
      ];
    },
  };
};

// Sub-agent files carry a `<file>.meta.json` linking them to the parent's tool_use.
export interface SpawnRegistry {
  add(agentId: string, meta: unknown): void;
  readonly lookup: DecoderConfig["spawns"];
}

export const spawnRegistry = (): SpawnRegistry => {
  const byToolUse = new Map<string, Spawn>();
  return {
    add(id, raw) {
      const meta = rec(raw);
      const toolUseId = str(meta?.toolUseId);
      if (!toolUseId) return;
      byToolUse.set(toolUseId, {
        agentId: AgentId(id),
        name: str(meta?.agentType) ?? "agent",
        description: str(meta?.description) ?? str(meta?.agentType) ?? "agent",
      });
    },
    lookup: (toolUseId) => byToolUse.get(toolUseId),
  };
};

export const spawnsFrom = (
  metas: Iterable<readonly [agentId: string, meta: unknown]>,
): DecoderConfig["spawns"] => {
  const registry = spawnRegistry();
  for (const [id, meta] of metas) registry.add(id, meta);
  return registry.lookup;
};

export const decodeAll = (cfg: DecoderConfig, lines: Iterable<unknown>) => {
  const d = makeDecoder(cfg);
  return [...Array.from(lines, (l) => d.push(l)).flat(), ...d.end()];
};
