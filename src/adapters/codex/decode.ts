import type { Decoder } from "@/adapters/shared/decoder.ts";
import { arr, type Json, num, rec, str } from "@/adapters/shared/json.ts";
import { reasonOf } from "@/adapters/shared/reason.ts";
import { requestEvents, SEARCH_HOST } from "@/adapters/shared/requests.ts";
import { sizeOf, tokensOf } from "@/adapters/shared/sizing.ts";
import {
  commandRefs,
  hostRefs,
  patchFiles,
  touchEvents,
} from "@/adapters/shared/touches.ts";
import type { RunEvent } from "@/domain/events.ts";
import type { AgentId } from "@/domain/ids.ts";
import { SpanId } from "@/domain/ids.ts";
import { mcpName } from "@/domain/mcp.ts";
import { providerOf } from "@/domain/models.ts";
import { targetsOfCommand } from "@/domain/network.ts";
import { file } from "@/domain/ref.ts";
import { type Entry, emptyUsage, type ModeChange } from "@/domain/run.ts";

export interface CodexConfig {
  // Epoch ms of the run start; event times are seconds from here.
  readonly origin: number;
  readonly agentId: AgentId;
  // Set for a thread another one spawned.
  readonly parentId?: AgentId;
  readonly name?: string;
}

type Source = Pick<Entry, "kind" | "label">;

const text = (content: unknown) =>
  arr(content)
    .map((b) => str(rec(b)?.text) ?? "")
    .join("");

const commandOf = (args: Json | undefined) => {
  const cmd = args?.cmd ?? args?.command;
  return Array.isArray(cmd) ? cmd.join(" ") : str(cmd);
};

const parseArgs = (raw: unknown) => {
  try {
    return rec(JSON.parse(String(raw)));
  } catch {
    return undefined;
  }
};

// An exec result says how it ended in text or JSON.
const failedOutput = (output: unknown) => {
  const s = typeof output === "string" ? output : JSON.stringify(output ?? "");
  const code = /exit[ _]code"?:? ?(-?\d+)/i.exec(s)?.[1];
  return code !== undefined && Number(code) !== 0;
};

// Unknown or malformed lines are ignored, never thrown on.
export const makeCodexDecoder = (cfg: CodexConfig): Decoder => {
  const { agentId } = cfg;
  const calls = new Map<string, { closed: boolean; source: Source }>();
  let announced = false;
  let boundary: number | undefined;
  let last = 0;
  let window: number | undefined;
  let model: string | undefined;
  let provider: string | undefined;
  const modes = new Map<string, string>();

  const added = (at: number, source: Source, chars: number): RunEvent[] =>
    chars > 0
      ? [
          {
            _tag: "ContextAdded",
            entry: { agentId, at, ...source, tokens: tokensOf(chars) },
          },
        ]
      : [];

  // The model's own time since the last thing it was told or did.
  const thinking = (id: string, at: number): RunEvent[] => {
    if (boundary === undefined || at <= boundary) return [];
    const spanId = SpanId(`think:${id}`);
    return [
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
    ];
  };

  const open = (
    id: string,
    name: string,
    label: string,
    at: number,
  ): RunEvent[] => {
    if (calls.has(id)) return [];
    calls.set(id, { closed: false, source: { kind: "Tool", label: name } });
    const mcp = mcpName(name);
    const base = {
      id: SpanId(id),
      agentId,
      label: label.split("\n")[0]?.slice(0, 80) || name,
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

  const close = (id: string, output: unknown, at: number): RunEvent[] => {
    const call = calls.get(id);
    if (!call || call.closed) return [];
    call.closed = true;
    return [
      ...added(at, call.source, sizeOf(output)),
      {
        _tag: "SpanClosed",
        spanId: SpanId(id),
        at,
        failed: failedOutput(output),
        reason: failedOutput(output) ? reasonOf(output) : undefined,
      },
    ];
  };

  const call = (
    p: Json,
    name: string,
    args: unknown,
    label: string,
    at: number,
  ): RunEvent[] => {
    const id = str(p.call_id) ?? str(p.id);
    if (!id) return [];
    const opened = open(id, name, label, at);
    // A patch names its files, whether it is a tool of its own or piped through a shell.
    const patched = patchFiles(
      `${label}\n${typeof args === "string" ? args : ""}`,
    );
    const targets = targetsOfCommand(label);
    return [
      ...added(at, { kind: "Tool", label: name }, sizeOf(args)),
      ...requestEvents(agentId, at, name, targets),
      ...opened,
      ...touchEvents(
        id,
        [
          ...patched.map((f) => file(f.path)),
          ...(patched.length || mcpName(name) ? [] : commandRefs(label)),
          ...hostRefs(targets),
        ],
        patched[0] && { op: patched[0].op },
      ),
    ];
  };

  const message = (p: Json, at: number): RunEvent[] => {
    const kinds = arr(
      rec(p.internal_chat_message_metadata_passthrough)?.content_item_kinds,
    );
    const typed = kinds.includes("user.text") || p.role === "assistant";
    const source: Source = {
      kind: "Message",
      label: typed ? "Messages" : "Reminders",
    };
    return [
      ...(p.role === "assistant" ? thinking(str(p.id) ?? String(at), at) : []),
      ...added(at, source, text(p.content).length),
    ];
  };

  const item = (p: Json, at: number): RunEvent[] => {
    switch (p.type) {
      case "message":
        return message(p, at);
      case "reasoning": {
        const chars =
          sizeOf(p.summary) || (str(p.encrypted_content)?.length ?? 0) * 0.75;
        return [
          ...thinking(str(p.id) ?? String(at), at),
          ...added(at, { kind: "Message", label: "Thinking" }, chars),
        ];
      }
      case "function_call": {
        const name = str(p.name) ?? "tool";
        return call(
          p,
          name,
          p.arguments,
          commandOf(parseArgs(p.arguments)) ?? name,
          at,
        );
      }
      case "custom_tool_call": {
        const name = str(p.name) ?? "tool";
        return call(p, name, p.input, name, at);
      }
      case "local_shell_call": {
        const cmd = commandOf(rec(p.action));
        return call(p, "shell", cmd, cmd ?? "shell", at);
      }
      case "web_search_call": {
        const query = str(rec(p.action)?.query) ?? "";
        return requestEvents(agentId, at, "web_search", [
          { host: SEARCH_HOST, label: query },
        ]);
      }
      case "function_call_output":
      case "custom_tool_call_output":
        return close(str(p.call_id) ?? "", p.output, at);
      default:
        return [];
    }
  };

  // Approval policy, sandbox and effort, reported when they change.
  const modeEvents = (p: Json, at: number): RunEvent[] => {
    const now: [ModeChange["kind"], string | undefined][] = [
      ["approval", str(p.approval_policy)],
      ["sandbox", str(rec(p.sandbox_policy)?.type)],
      ["effort", str(p.effort)],
    ];
    return now.flatMap(([kind, value]) => {
      if (!value || modes.get(kind) === value) return [];
      modes.set(kind, value);
      return [
        { _tag: "ModeChanged", change: { agentId, at, kind, value } } as const,
      ];
    });
  };

  // A skill the user named in their message.
  const mentions = (item: Json | undefined, at: number): RunEvent[] =>
    item?.type === "UserMessage"
      ? arr(item.content).flatMap((c) => {
          const name = rec(c)?.type === "skill" ? str(rec(c)?.name) : undefined;
          return name
            ? [
                {
                  _tag: "SkillUsed",
                  use: { agentId, at, name, via: "mention" },
                } as const,
              ]
            : [];
        })
      : [];

  const usage = (info: Json): RunEvent[] => {
    const u = rec(info.last_token_usage);
    if (!u) return [];
    const input = num(u.input_tokens);
    const cached = num(u.cached_input_tokens);
    return [
      {
        _tag: "TurnReported",
        turn: {
          agentId,
          at: last,
          model,
          provider: provider ?? providerOf(model),
          window: num(info.model_context_window) || window,
          usage: {
            input: Math.max(0, input - cached),
            output: num(u.output_tokens),
            cacheRead: cached,
            cacheWrite: 0,
          },
        },
      },
    ];
  };

  const event = (p: Json, at: number): RunEvent[] => {
    switch (p.type) {
      case "task_started":
        window = num(p.model_context_window) || window;
        return [];
      case "token_count": {
        const info = rec(p.info);
        return info ? usage(info) : [];
      }
      case "task_complete":
      case "turn_aborted":
        return [{ _tag: "AgentFinished", agentId, at }];
      case "context_compacted":
        return [{ _tag: "ContextCompacted", agentId, at }];
      case "item_completed":
        return mentions(rec(p.item), at);
      default:
        return [];
    }
  };

  const meta = (p: Json, at: number): RunEvent[] => {
    provider = str(p.model_provider) ?? provider;
    const instructions = rec(p.base_instructions);
    const system = tokensOf(sizeOf(instructions?.text ?? instructions));
    return system > 0
      ? [{ _tag: "SetupReported", setup: { agentId, at, system, tools: [] } }]
      : [];
  };

  const decode = (type: unknown, p: Json, at: number): RunEvent[] => {
    switch (type) {
      case "session_meta":
        return meta(p, at);
      case "turn_context":
        model = str(p.model) ?? model;
        // Usage arrives later; the turn already says which model and window.
        return [
          ...modeEvents(p, at),
          {
            _tag: "TurnReported",
            turn: {
              agentId,
              at,
              model,
              window,
              provider: provider ?? providerOf(model),
              usage: emptyUsage,
            },
          },
        ];
      case "compacted":
        return [{ _tag: "ContextCompacted", agentId, at }];
      case "event_msg":
        return event(p, at);
      case "response_item":
        return item(p, at);
      default:
        return [];
    }
  };

  return {
    push(raw) {
      const line = rec(raw);
      const p = rec(line?.payload);
      const ts = Date.parse(str(line?.timestamp) ?? "");
      if (!line || !p || Number.isNaN(ts)) return [];
      const at = (ts - cfg.origin) / 1000;
      last = at;

      const events: RunEvent[] = [];
      if (!announced) {
        announced = true;
        events.push({
          _tag: "AgentSpawned",
          agent: {
            id: agentId,
            parentId: cfg.parentId ?? null,
            name: cfg.name ?? "codex",
          },
          at,
        });
      }
      events.push(...decode(line.type, p, at));
      if (line.type === "response_item" || p.type === "task_started") {
        boundary = at;
      }
      return events;
    },

    settle: () => [],

    end() {
      const dangling = [...calls]
        .filter(([, c]) => !c.closed)
        .map(
          ([id]): RunEvent => ({
            _tag: "SpanClosed",
            spanId: SpanId(id),
            at: last,
          }),
        );
      return [...dangling, { _tag: "AgentFinished", agentId, at: last }];
    },
  };
};
