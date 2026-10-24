const unquote = (v: string) => v.replace(/^(["'])(.*)\1$/, "$2");

// The `key: value` lines between the leading `---` fences; folded blocks keep their first line.
export const frontmatter = (text: string): Record<string, string> => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out: Record<string, string> = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv?.[1] && kv[2] !== undefined) out[kv[1]] = unquote(kv[2].trim());
  }
  return out;
};
