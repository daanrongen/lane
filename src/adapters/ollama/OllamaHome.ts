import { homedir } from "node:os";
import { Context, Layer } from "effect";

// Root of Ollama's data, e.g. ~/.ollama.
export class OllamaHome extends Context.Service<OllamaHome, string>()(
  "OllamaHome",
) {
  static readonly layer = (path: string) => Layer.succeed(OllamaHome, path);
  static readonly default = OllamaHome.layer(`${homedir()}/.ollama`);
}
