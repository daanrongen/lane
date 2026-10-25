# lane

A native, GPU-rendered dashboard that shows what your AI coding agents are doing.

It watches local Claude Code and Codex sessions (plus agents and ollama asset homes) and renders one session's run as a timeline. It follows the macOS light/dark appearance.

## What it shows

- A lane per agent with thinking, tool call, MCP call, waiting and failed bars
- Request marks, skill marks, model ribbons and a mode band
- Handoff links between parent and sub-agents, with idle gaps collapsed on the axis
- A legend, MCP servers used with call counts, network hosts reached, and skills and models used
- A context-window treemap for the selected agent (categories, Other, Free)
- A Tasks board (Done / Doing / Next) of what agents did, are doing and have queued
- A session sidebar grouped by directory (a switcher on narrow windows)

## Install

Requires Apple Silicon macOS.

```sh
brew install daanrongen/lane/lane
lane
```

## Modes

`lane` renders in the terminal when it speaks the kitty graphics protocol (Ghostty, kitty, WezTerm) and opens a native window otherwise. Override it with a flag or `LANE_MODE`.

| Flag | Env | Result |
| --- | --- | --- |
| `--terminal` | `LANE_MODE=terminal` | render in this terminal |
| `--window` | `LANE_MODE=window` | open a native window |

## From source

Requires Bun.

```sh
bun install
bun run demo   # fake data
bun run live   # real local sessions
```

## Keys

| Key | Action |
| --- | --- |
| `j` / `k` | next / previous session |
| `[` / `]` | previous / next directory |
| `h` / `l` | previous / next agent |
| `+` / `-` | zoom in / out (`0` resets) |
| `q` | quit |

## Architecture

Hexagonal, under `src/`:

- `domain/`: pure models and folds (run, timeline, axis, context, board, mcp, models, network, skills, task, usage)
- `ports/`: Harness, RunSource, SessionRepository, TaskRepository, Assets, SourceError
- `adapters/`: claude, codex (reads SQLite for goals, queued prompts and spawned threads), agents, ollama, macOS appearance, in-memory fakes for tests
- `app/`: SessionsStore, Layers, the bridge to UI ports, demo data
- `ui/`: atoms, molecules, organisms, pages, templates
- `bin/`: entry points (start, demo, live, shot, binary, native)

Built with `@gpuix/react` and `@gpuix/native`, React 19, Bun, Effect 4, d3-scale and d3-hierarchy.

## Development

| Command | Purpose |
| --- | --- |
| `bun run shot` | screenshot |
| `bun run build` | compile a single binary to `dist/lane` |
| `bun test ./src` | tests |
| `bun run typecheck` | type check |
| `bun run check` | biome lint |
| `bun run format` | biome format |

Lefthook runs format and check on pre-commit, and test, typecheck and build on pre-push.
