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
import {
  commandRefs,
  hostRefs,
  shellWrites,
  subjectRefs,
  touchEvents,
} from "@/adapters/shared/touches.ts";
import type { Approval, Edit } from "@/domain/act.ts";
import type { RunEvent } from "@/domain/events.ts";
import { ActId, AgentId, SpanId } from "@/domain/ids.ts";
import { mcpName } from "@/domain/mcp.ts";
import { providerOf } from "@/domain/models.ts";
import { type Target, targetsOfCommand } from "@/domain/network.ts";
import { file, folder, type Ref, skill, subject } from "@/domain/ref.ts";
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

const FILE_TOOLS = new Set([
  "Read",
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
]);

// What a call touches, as far as its input shows.
const touchesOf = (
  name: string,
  input: Json | undefined,
  targets: readonly Target[],
): Ref[] => {
  const path = str(input?.file_path) ?? str(input?.notebook_path);
  const dir = str(input?.path);
  return [
    ...(FILE_TOOLS.has(name) && path ? [file(path)] : []),
    ...(dir && (name === "Grep" || name === "Glob") ? [folder(dir)] : []),
    ...(name === "Bash" ? commandRefs(str(input?.command)) : []),
    ...(name === "Bash"
      ? shellWrites(str(input?.command)).map((p) => file(p))
      : []),
    ...(name === "Skill" && str(input?.skill)
      ? [skill(String(input?.skill))]
      : []),
    ...hostRefs(targets),
    ...subjectRefs(
      name === "Bash"
        ? str(input?.command)
        : name === "WebFetch"
          ? str(input?.url)
          : mcpName(name)
            ? JSON.stringify(input)
            : undefined,
      mcpName(name) !== undefined,
    ),
  ];
};

const shellEdit = (input: Json | undefined): Edit | undefined =>
  shellWrites(str(input?.command)).length ? { op: "modify" } : undefined;

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

// Who let a call through, as the result line records it.
const approvalOf = (d: Json | undefined): Approval | undefined => {
  const decision = str(d?.decision);
  if (!decision) return undefined;
  const reason = str(d?.reasonType);
  const by = str(d?.source)?.startsWith("user")
    ? "user"
    : reason === "classifier" || reason === "rule"
      ? reason
      : "policy";
  return {
    by,
    rule: by === "rule" ? str(d?.ruleSource) : undefined,
    outcome: decision === "accept" ? "allow" : "deny",
  };
};

const HOOK_FAILURES = new Set([
  "hook_blocking_error",
  "hook_non_blocking_error",
  "hook_error_during_execution",
  "hook_stopped_continuation",
  "hook_cancelled",
]);

// A hook that passed quickly is routine and left out.
const SLOW_HOOK = 2_000;

const STEP = /^\s*(?:[-*]|\d+[.)])\s+(.+)$/;

// A plan in markdown: the first line is the title, the list items are the steps.
const planOf = (text: string) => {
  const lines = text.split("\n").filter((l) => l.trim());
  return {
    title: (lines[0] ?? "plan").replace(/^#+\s*/, "").slice(0, 80),
    steps: lines.flatMap((l) => STEP.exec(l)?.[1]?.slice(0, 100) ?? []),
  };
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
  const handbacks = new Set<string>();
  const spans = new Map<string, boolean>(); // tool_use id -> closed
  const sources = new Map<string, Pick<Entry, "kind" | "label">>();
  const plans = new Set<string>();
  let lastCall: string | undefined;
  let permission: string | undefined;
  let effort: string | undefined;
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
    if (!SPAWN_TOOLS.has(name)) lastCall = id;
    if (!SPAWN_TOOLS.has(name))
      return [
        ...entry,
        ...called(id, name, input, at),
        ...proposed(id, name, input, at),
        ...touchEvents(
          id,
          touchesOf(name, input, targetsOf(name, input)),
          name === "Bash" ? shellEdit(input) : undefined,
        ),
      ];
    pending.set(id, { name, input, at });
    return [...entry, ...resolve(id, false)];
  };

  const proposed = (
    id: string,
    name: string,
    input: Json | undefined,
    at: number,
  ): RunEvent[] => {
    const text = name === "ExitPlanMode" ? str(input?.plan) : undefined;
    if (!text) return [];
    plans.add(id);
    return [
      {
        _tag: "PlanProposed",
        plan: {
          id,
          agentId,
          at,
          status: "proposed",
          ...planOf(text),
        },
      },
    ];
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

  // A hook run that failed or took long, as an act so it shows in the lane and feed.
  const hook = (a: Json | undefined, line: Json, at: number): RunEvent[] => {
    const type = str(a?.type) ?? "";
    const failed = HOOK_FAILURES.has(type);
    const ms = num(a?.durationMs);
    if (!a || (!failed && !(type === "hook_success" && ms >= SLOW_HOOK))) {
      return [];
    }
    const name = str(a.hookName) ?? str(a.hookEvent) ?? "hook";
    const cmd = str(a.command);
    const why =
      str(a.stderr) ??
      str(a.content) ??
      str(rec(a.blockingError)?.blockingError);
    return [
      {
        _tag: "ActOpened",
        act: {
          id: ActId(`hook:${str(line.uuid) ?? at}`),
          agentId,
          kind: "tool",
          tool: "hook",
          label: [name, cmd].filter(Boolean).join(": ").slice(0, 80),
          start: Math.max(0, at - ms / 1000),
          end: at,
          status: failed ? "failed" : "ok",
          touches: commandRefs(cmd),
          failure: failed
            ? {
                class: "hook",
                reason: (why?.split("\n")[0] || type).slice(0, 200),
              }
            : undefined,
          exit: a.exitCode === undefined ? undefined : num(a.exitCode),
          fidelity: "observed",
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
    const level = str(line.effort);
    if (level && level !== effort) {
      effort = level;
      events.push({
        _tag: "ModeChanged",
        change: { agentId, at, kind: "effort", value: level },
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
    const calls = arr(msg.content).filter(
      (b) => rec(b)?.name === "SubagentHandback",
    );
    for (const c of calls) handbacks.add(str(rec(c)?.id) ?? "");
    const handback = calls.length > 0;
    if (id && (msg.stop_reason === "end_turn" || handback) && !ended.has(id)) {
      ended.add(id);
      events.push({ _tag: "AgentFinished", agentId, at });
    }
    return events;
  };

  const decided = (line: Json, id: string, failed: boolean): RunEvent[] => {
    const approval = approvalOf(rec(line.permissionDecision));
    return [
      ...(approval
        ? [{ _tag: "ActUpdated", id: ActId(id), approval } as const]
        : []),
      ...(plans.has(id)
        ? [
            {
              _tag: "PlanDecided",
              id,
              status: failed ? "rejected" : "approved",
            } as const,
          ]
        : []),
    ];
  };

  const user = (line: Json, msg: Json, at: number): RunEvent[] =>
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
        // The handback's own result is the agent's last event, so it finishes then.
        ...(handbacks.has(id)
          ? [{ _tag: "AgentFinished", agentId, at } as const]
          : []),
        ...(source ? added(at, source, sizeOf(block.content)) : []),
        ...added(
          at,
          { kind: "File", label: "Images" },
          IMAGE_TOKENS * 4 * imagesIn(block.content),
        ),
        ...resolve(id, true),
        ...decided(line, id, block?.is_error === true),
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
      // Spend so far; it carries no timestamp either.
      if (line?.type === "cost-state") {
        const usd = num(line.totalCostUSD);
        return usd
          ? [
              {
                _tag: "SignalReported",
                reading: { agentId, at: last, signal: { _tag: "Cost", usd } },
              },
            ]
          : [];
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
      // A pull request the agent made, written after the call that made it.
      if (line.type === "pr-link" && lastCall) {
        const repo = str(line.prRepository);
        const n = num(line.prNumber);
        return n
          ? touchEvents(lastCall, [subject("pr", `${repo ? repo : ""}#${n}`)])
          : [];
      }
      if (type === "attachment") {
        const attachment = rec(line.attachment);
        return [
          ...setup(attachment, at),
          ...hook(attachment, line, at),
          ...reminder(attachment, at),
        ];
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
        ...(type === "assistant"
          ? assistant(line, msg, at)
          : user(line, msg, at)),
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
