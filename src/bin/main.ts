import { answerCli, route } from "@/bin/cli.ts";

const args = process.argv.slice(2);

// Loaded on demand so a command never pays for the native renderer.
if (route(args) === "cli") {
  const { main } = await import("@/cli/main.ts");
  process.exit(await main(args));
} else {
  answerCli();
  await import("@/bin/native.ts");
  await import("@/bin/live.tsx");
}
