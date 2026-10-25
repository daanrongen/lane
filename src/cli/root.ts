import { Command } from "effect/cli";
import { agents } from "@/cli/commands/agents.ts";
import { attention } from "@/cli/commands/attention.ts";
import { status } from "@/cli/commands/status.ts";
import { tasks } from "@/cli/commands/tasks.ts";
import { threads } from "@/cli/commands/threads.ts";

export const lane = Command.make("lane").pipe(
  Command.withDescription(
    "Read-only views of your coding agents: a table in a terminal, JSON when piped",
  ),
  Command.withSubcommands([status, threads, tasks, agents, attention]),
);
