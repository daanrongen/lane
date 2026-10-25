import pkg from "../../package.json" with { type: "json" };

export type Mode = "terminal" | "window";

const HELP = `lane ${pkg.version}: a timeline of what your coding agents are doing

usage: lane [--terminal | --window]

  --terminal  render in this terminal (kitty graphics: Ghostty, kitty, WezTerm)
  --window    open a native window
  --version   print the version
  --help      print this help

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

export const answerCli = () => {
  const args = process.argv.slice(2);
  if (args.includes("--version")) console.log(pkg.version);
  else if (args.includes("--help")) console.log(HELP);
  else return;
  process.exit(0);
};
