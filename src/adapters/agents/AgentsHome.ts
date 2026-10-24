import { homedir } from "node:os";
import { Context, Layer } from "effect";

// Root of the shared agent folder, e.g. ~/.agents.
export class AgentsHome extends Context.Service<AgentsHome, string>()(
  "AgentsHome",
) {
  static readonly layer = (path: string) => Layer.succeed(AgentsHome, path);
  static readonly default = AgentsHome.layer(`${homedir()}/.agents`);
}
