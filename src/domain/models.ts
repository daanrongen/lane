// Who served a model, as far as its name shows: Claude's are Anthropic's, `name:tag` is Ollama's.
export const providerOf = (model: string | undefined) => {
  if (!model) return undefined;
  if (model.startsWith("claude-")) return "anthropic";
  if (model.includes(":")) return "ollama";
  return /^(gpt|o\d|codex)/.test(model) ? "openai" : undefined;
};
