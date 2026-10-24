import { arr, rec, str } from "@/adapters/shared/json.ts";

// The first line of an error, as far as its content shows it.
export const reasonOf = (content: unknown) => {
  const text =
    typeof content === "string"
      ? content
      : arr(content)
          .map((b) => str(rec(b)?.text) ?? "")
          .join("\n");
  const line = text
    .split("\n")
    .find((l) => l.trim().length > 0)
    ?.trim();
  return line && line.length > 120 ? `${line.slice(0, 119)}…` : line;
};
