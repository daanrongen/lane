import { homedir } from "node:os";
import { Context, Layer } from "effect";

// Root of Claude Code's data, e.g. ~/.claude.
export class ClaudeHome extends Context.Service<ClaudeHome, string>()(
  "ClaudeHome",
) {
  static readonly layer = (path: string) => Layer.succeed(ClaudeHome, path);
  static readonly default = ClaudeHome.layer(`${homedir()}/.claude`);
}
