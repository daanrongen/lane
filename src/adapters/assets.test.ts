import { describe, expect, test } from "bun:test";
import { Effect, FileSystem } from "effect";
import { AgentsHome } from "@/adapters/agents/AgentsHome.ts";
import { agentsAssets } from "@/adapters/agents/assets.ts";
import { claudeAssets } from "@/adapters/claude/assets.ts";
import { ClaudeHome } from "@/adapters/claude/ClaudeHome.ts";
import { runFs } from "@/adapters/claude/fixtures.ts";
import { codexAssets } from "@/adapters/codex/assets.ts";
import { CodexHome } from "@/adapters/codex/CodexHome.ts";
import { ollamaAssets } from "@/adapters/ollama/assets.ts";
import { OllamaHome } from "@/adapters/ollama/OllamaHome.ts";
import { groupAssets } from "@/domain/assets.ts";

const write = (fs: FileSystem.FileSystem, path: string, text: string) =>
  Effect.gen(function* () {
    yield* fs.makeDirectory(path.slice(0, path.lastIndexOf("/")), {
      recursive: true,
    });
    yield* fs.writeFileString(path, text);
  });

const skill = (name: string, description: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\nbody`;

describe("agents assets", () => {
  test("reads shared skills and skips folders without a SKILL.md", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        yield* write(
          fs,
          `${home}/skills/mise/SKILL.md`,
          skill("mise", "tools"),
        );
        yield* fs.makeDirectory(`${home}/skills/empty`, { recursive: true });
        const reader = yield* agentsAssets.pipe(
          Effect.provide(AgentsHome.layer(home)),
        );
        expect(yield* reader.read("/x")).toEqual([
          {
            _tag: "Skill",
            source: "agents",
            name: "mise",
            description: "tools",
          },
        ]);
      }),
    ));
});

describe("claude assets", () => {
  test("reads settings, skills and mcp servers, global and per project", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const cwd = yield* fs.makeTempDirectoryScoped();
        yield* write(
          fs,
          `${home}/settings.json`,
          JSON.stringify({
            model: "sonnet",
            permissions: {
              allow: ["Bash(ls)"],
              deny: ["Read(.env)"],
              defaultMode: "auto",
            },
            enabledPlugins: { "a@b": true, "c@d": false },
          }),
        );
        yield* write(
          fs,
          `${home}/skills/blender/SKILL.md`,
          skill("blender", "3d"),
        );
        yield* write(
          fs,
          `${cwd}/.mcp.json`,
          JSON.stringify({
            mcpServers: {
              linear: { url: "https://x" },
              local: { command: "x" },
            },
          }),
        );
        yield* write(
          fs,
          `${cwd}/.claude/settings.local.json`,
          JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
        );

        const reader = yield* claudeAssets.pipe(
          Effect.provide(ClaudeHome.layer(home)),
        );
        const found = yield* reader.read(cwd);
        const summary = groupAssets(found).map((g) => [
          g.kind,
          g.source,
          g.assets.length,
        ]);
        expect(summary).toContainEqual(["Rule", "claude", 2]);
        expect(summary).toContainEqual(["Rule", "project", 1]);
        expect(summary).toContainEqual(["Plugin", "claude", 1]);
        expect(summary).toContainEqual(["Skill", "claude", 1]);
        expect(summary).toContainEqual(["Mcp", "project", 2]);
        expect(found).toContainEqual({
          _tag: "Setting",
          source: "claude",
          key: "model",
          value: "sonnet",
        });
        expect(found).toContainEqual({
          _tag: "Mcp",
          source: "project",
          name: "linear",
          transport: "http",
        });
      }),
    ));

  test("a missing home has nothing", () =>
    runFs(
      Effect.gen(function* () {
        const reader = yield* claudeAssets.pipe(
          Effect.provide(ClaudeHome.layer("/nope/.claude")),
        );
        expect(yield* reader.read("/nope")).toEqual([]);
      }),
    ));
});

describe("codex assets", () => {
  test("reads config.toml settings, mcp servers and skills", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        yield* write(
          fs,
          `${home}/config.toml`,
          'model = "gpt-5.5"\nmodel_reasoning_effort = "high"\n[mcp_servers.linear]\nurl = "https://x"\n[mcp_servers.fs]\ncommand = "npx"\n',
        );
        yield* write(
          fs,
          `${home}/skills/container/SKILL.md`,
          skill("container", "vm"),
        );
        const reader = yield* codexAssets.pipe(
          Effect.provide(CodexHome.layer(home)),
        );
        const found = yield* reader.read("/x");
        expect(found).toContainEqual({
          _tag: "Setting",
          source: "codex",
          key: "model",
          value: "gpt-5.5",
        });
        expect(
          found.filter((a) => a._tag === "Mcp").map((a) => a.name),
        ).toEqual(["linear", "fs"]);
        expect(found.filter((a) => a._tag === "Skill")).toHaveLength(1);
      }),
    ));
});

describe("ollama assets", () => {
  test("lists installed models with their size", () =>
    runFs(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const dir = `${home}/models/manifests/registry.ollama.ai`;
        const manifest = JSON.stringify({
          layers: [{ size: 100 }, { size: 50 }],
        });
        yield* write(fs, `${dir}/library/granite4/latest`, manifest);
        yield* write(fs, `${dir}/someone/model/7b`, manifest);
        const reader = yield* ollamaAssets.pipe(
          Effect.provide(OllamaHome.layer(home)),
        );
        const found = yield* reader.read("/x");
        expect(
          found.map((a) => (a._tag === "Model" ? [a.name, a.bytes] : [])),
        ).toEqual([
          ["granite4:latest", 150],
          ["someone/model:7b", 150],
        ]);
      }),
    ));
});
