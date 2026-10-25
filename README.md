# lane

A native, GPU-rendered operations view of every AI agent running on your machine, whichever harness runs it.

It follows Claude Code and Codex threads and the processes behind them (plus the models a local Ollama server has loaded, and the agents and Ollama asset homes) and shows them in one view. It follows the macOS light/dark appearance.

Besides the app, `lane` has read-only [commands](#commands) for scripts and quick checks, such as `lane threads ls` and `lane tasks ls`.

## What it shows

One view with no sub-pages: a fixed top bar, a scrolling main and a fixed controls bar.

- Top bar: agents by state, harness counts, tokens and spend
- Attention strip: who needs you, is stalled or failed, and for how long
- Fleet: a row per agent grouped by workspace, with its state, model, current act, context fill and insights, and its own lane on one shared time axis; runtimes such as Ollama beside the agents using them
- Where they work: each workspace's touched files as a tree, with agents drawn on the nodes and a mark where two agents meet on a file
- Detail: for the selected agent, what it is doing, its context, its plan with the current and upcoming tasks under it, and setup, side by side; with nothing selected, the machine's harnesses, what is up next and what looks wrong
- Feed and changes: what every agent did lately with an activity histogram, and the files edited across agents
- Cost: spend so far where the harness totals it (Claude Code, from its cost state) in the top bar and the detail; `n/a` elsewhere
- Up next: an idle agent's row shows the next item of its todo list, queue or goal; the machine panel lists them
- Notifications: a macOS notification when an agent needs you, stalls, fails or finishes (`bun run live` and the binary)
- History and replay: earlier runs of a workspace, and any run played back from its start with a playhead
- A facet a harness cannot report shows `n/a` instead of zero

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

## Commands

Read-only queries that print and exit, without opening the app. Output is a table in a terminal and JSON when piped; `--json` or `--format table|json|ndjson` choose it.

| Command | Shows |
| --- | --- |
| `lane status` | agents by state, who needs you, tokens and spend (`--line` for a prompt) |
| `lane threads ls` / `show <thread>` | threads of every harness, newest first; one thread's workspace, usage, models and agents |
| `lane tasks ls [thread]` / `next` | what each agent is doing and has lined up next |
| `lane agents ls` / `show <agent>` | every agent with state, model, context fill, cost and what it is doing now |
| `lane attention` | who needs you, is stalled or failed (`--exit-code` exits 1 when anyone does) |
| `lane feed` | what every agent did lately (`--kind`, `--agent`, `--text`, `--touching <file, host, ...>`) |
| `lane acts [thread]` | every act of a thread with status, failure and what it touched (`--kind`, `--failed`, `--awaiting`) |
| `lane files` / `tree [dir]` | files agents read or changed, and a workspace's touched tree (`--edited`, `--shared`) |
| `lane usage` | tokens and spend by `--by model\|harness\|workspace\|thread`; `n/a` where a harness cannot report cost |
| `lane plan [thread]` / `context [thread]` | plans put to a person; what fills an agent's context window |
| `lane assets` | skills, MCP servers, models, rules, plugins and settings (`--kind`, `-w`) |
| `lane mcp` / `skills` / `hosts` / `models` | what agents used, per thread or across the live ones, against the catalog |
| `lane harnesses` / `runtimes` | what each harness can report (native, partial or n/a); the models Ollama has loaded |
| `lane doctor` | which harness data is found and readable; exits 1 if a harness cannot be listed |

A `<thread>` is an id, `harness:id`, an id prefix, a directory or part of a name. An `<agent>` is a full or partial `harness:thread:agent` ref, or a name.

Options shared by the listing commands:

| Flag | Meaning |
| --- | --- |
| `--harness <id>` | only `claude`, `codex`, ... |
| `-w`, `--workspace <path>` | only this directory and below |
| `-n`, `--limit <rows>` | most rows (`threads ls` shows 30 by default) |
| `--all` | every thread, not just live and recent ones |
| `--no-probe` | do not look at running processes |
| `--no-header` | leave the header row out of a table |
| `-f`, `--watch` | read again and redraw every 2 seconds until interrupted (`--every <seconds>`); appends one result per read when piped |

Each command adds its own filters: `threads ls` takes `--live`, `--past`, `--status` and `--since 2h`; `tasks ls` takes `--status doing|next|done|any`, `--source` and `--owner`; `agents ls` takes `--state`. Run `lane <command> --help` for the full list.

```sh
lane status --line                          # 1 working · 2 done · 108k out · $4.12
lane threads ls --live -w .                 # live threads in this directory
lane tasks ls .                             # doing and next, for the newest thread here
lane agents ls --state stalled --json | jq  # machine-readable
lane attention --exit-code || notify-send   # exit 1 when anyone needs you
lane feed --touching package.json -f        # follow what touches a file
```

Tasks list what an agent is doing now and what is lined up next, including work handed to sub-agents. Without a thread, `tasks ls` covers every live and recent one; done tasks appear with `--status done` or `any`.

JSON carries raw values (epoch milliseconds, numbers, enums) under snake_case keys, never display strings like `3m`. Data goes to stdout and errors to stderr. Exit codes: `0` ok, `1` error, `2` bad usage, `3` no match or an ambiguous one.

Shell completions: `lane --completions zsh` (also `bash` and `fish`).

## From source

Requires Bun.

```sh
bun install
bun run demo   # a looping scenario across several harnesses
bun run live   # real local threads and processes
bun run cli threads ls
```

## Keys

| Key | Action |
| --- | --- |
| `up` / `down` | previous / next agent |
| `n` / `N` | next / previous agent that needs attention |
| `/` | find an agent, or a file, host, MCP server, skill or model to filter the feed (click a tree node to do the same) |
| `t` / `a` | only shared files / also finished sub-agents |
| `h` | history: earlier runs of the selected agent's workspace, or of all; `enter` replays one |
| `r` | replay the selected agent from its start (`space` pause, `1` `2` `3` for 1x, 2x, 10x, `←→` seek, `0` restart, `esc` back) |
| `+` / `-` | zoom the time lanes |
| `esc` | clear the feed filter, then the selection (clicking the selected row does too) |
| `?` | help |
| `q` | quit |

## Architecture

Hexagonal, under `src/`:

- `domain/`: pure models and folds (thread, run, act, ref, signal, link, plan, agent state, attention, alerts, replay, insights, file tree, floor, timeline, context, mcp, models, network, skills, task)
- `ports/`: Harness, RunSource, ThreadRepository, TaskRepository, Assets, ProcessProbe, Workspaces, Runtimes, SourceError
- `adapters/`: claude, codex (reads SQLite for goals, queued prompts and spawned threads), agents, ollama (assets and the loaded-model runtime), macOS appearance and notifications, process and git workspace detection, and in-memory fakes, including a scenario that plays many harnesses' work in real time
- `app/`: SessionsStore, Fleet (one floor of every live thread and process), Layers, the bridge to UI ports
- `ui/`: atoms, molecules, organisms, pages, templates
- `cli/`: the headless commands, built on `effect/cli`, reading one snapshot through `app/Snapshot`
- `bin/`: entry points (main routes to `cli/` or the app; start, demo, live, shot, native)

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
