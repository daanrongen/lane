import { NAMES } from "@/cli/names.ts";
import pkg from "../../package.json" with { type: "json" };

export type Mode = "terminal" | "window";

const HELP = `lane ${pkg.version}: a timeline of what your coding agents are doing

usage: lane [--terminal | --window]
       lane <command> [options]

  --terminal  render in this terminal (kitty graphics: Ghostty, kitty, WezTerm)
  --window    open a native window
  --version   print the version
  --help      print this help

commands (read-only; a table in a terminal, JSON when piped):

  status      the machine at a glance
  threads     list and inspect threads
  tasks       what agents are doing and have lined up next
  agents      list and inspect agents
  attention   who needs you

Run lane <command> --help for its options, --json or --format table|json|ndjson to choose the output,
and lane --completions zsh|bash|fish for shell completions.

With neither flag, LANE_MODE=terminal|window applies, else lane renders in
the terminal if it speaks kitty graphics and opens a window if not.`;

const speaksKitty = (env: Record<string, string | undefined>) =>
  ["ghostty", "WezTerm"].includes(env.TERM_PROGRAM ?? "") ||
  env.KITTY_WINDOW_ID !== undefined ||
  ["xterm-kitty", "xterm-ghostty"].includes(env.TERM ?? "");

export const resolveMode = (
  args: string[],
  env: Record<string, string | undefined>,
): Mode => {
  if (args.includes("--terminal")) return "terminal";
  if (args.includes("--window")) return "window";
  if (env.LANE_MODE === "terminal" || env.LANE_MODE === "window")
    return env.LANE_MODE;
  return speaksKitty(env) ? "terminal" : "window";
};

export type Route = "cli" | "gui";

// A known command word first means print and exit; anything else opens the app.
export const route = (args: readonly string[]): Route =>
  (NAMES as readonly string[]).includes(args[0] ?? "") ||
  args[0] === "--completions"
    ? "cli"
    : "gui";

export const answerCli = () => {
  const args = process.argv.slice(2);
  if (args.includes("--version")) console.log(pkg.version);
  else if (args.includes("--help")) console.log(HELP);
  else return;
  process.exit(0);
};
