import { Command } from "effect/cli";
import { acts } from "@/cli/commands/acts.ts";
import { agents } from "@/cli/commands/agents.ts";
import { assets } from "@/cli/commands/assets.ts";
import { attention } from "@/cli/commands/attention.ts";
import { context } from "@/cli/commands/context.ts";
import { doctor } from "@/cli/commands/doctor.ts";
import { feed } from "@/cli/commands/feed.ts";
import { files, tree } from "@/cli/commands/files.ts";
import { harnesses } from "@/cli/commands/harnesses.ts";
import { plan } from "@/cli/commands/plan.ts";
import { hosts, mcp, models, skills } from "@/cli/commands/rollups.ts";
import { runtimes } from "@/cli/commands/runtimes.ts";
import { status } from "@/cli/commands/status.ts";
import { tasks } from "@/cli/commands/tasks.ts";
import { threads } from "@/cli/commands/threads.ts";
import { usage } from "@/cli/commands/usage.ts";
import type { NAMES } from "@/cli/names.ts";

// Every name in NAMES is a subcommand here; the router reads NAMES to tell commands from the app.
const commands = {
  status,
  threads,
  tasks,
  agents,
  attention,
  feed,
  acts,
  files,
  tree,
  usage,
  plan,
  context,
  assets,
  mcp,
  skills,
  hosts,
  models,
  harnesses,
  runtimes,
  doctor,
} satisfies Record<(typeof NAMES)[number], unknown>;

export const lane = Command.make("lane").pipe(
  Command.withDescription(
    "Read-only views of your coding agents: a table in a terminal, JSON when piped",
  ),
  Command.withSubcommands(Object.values(commands)),
);
