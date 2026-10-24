// Synthetic rollout lines in Codex's shape, for tests.
export const origin = Date.parse("2026-01-01T00:00:00Z");
export const iso = (s: number) => new Date(origin + s * 1000).toISOString();

const line = (s: number, type: string, payload: object) => ({
  timestamp: iso(s),
  type,
  payload,
});

export const meta = (s: number, id = "sess", cwd = "/work") =>
  line(s, "session_meta", {
    id,
    cwd,
    base_instructions: { text: "x".repeat(40) },
  });

export const started = (s: number, window = 200_000) =>
  line(s, "event_msg", { type: "task_started", model_context_window: window });

export const finished = (s: number) =>
  line(s, "event_msg", { type: "task_complete" });

export const model = (s: number, name = "gpt-5.5") =>
  line(s, "turn_context", { model: name });

export const tokens = (
  s: number,
  input: number,
  cached: number,
  output: number,
) =>
  line(s, "event_msg", {
    type: "token_count",
    info: {
      last_token_usage: {
        input_tokens: input,
        cached_input_tokens: cached,
        output_tokens: output,
      },
      model_context_window: 258_400,
    },
  });

export const said = (s: number, role: string, text: string) =>
  line(s, "response_item", {
    type: "message",
    id: `m${s}`,
    role,
    content: [
      { type: role === "assistant" ? "output_text" : "input_text", text },
    ],
    internal_chat_message_metadata_passthrough: {
      content_item_kinds: [role === "user" ? "user.text" : "other"],
    },
  });

export const call = (s: number, id: string, name: string, args: object) =>
  line(s, "response_item", {
    type: "function_call",
    name,
    call_id: id,
    arguments: JSON.stringify(args),
  });

export const output = (s: number, id: string, text: string) =>
  line(s, "response_item", {
    type: "function_call_output",
    call_id: id,
    output: text,
  });
