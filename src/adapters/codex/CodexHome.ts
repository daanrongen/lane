import { homedir } from "node:os";
import { Context, Layer } from "effect";

// Root of Codex's data, e.g. ~/.codex.
export class CodexHome extends Context.Service<CodexHome, string>()(
  "CodexHome",
) {
  static readonly layer = (path: string) => Layer.succeed(CodexHome, path);
  static readonly default = CodexHome.layer(`${homedir()}/.codex`);
}
