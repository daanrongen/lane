import type { Script } from "@/adapters/memory/ScriptedRuns.ts";
import {
  beat,
  call,
  compact,
  ctx,
  delegate,
  finish,
  limit,
  main,
  mode,
  request,
  setup,
  skill,
  spawn,
  task,
  think,
  turn,
} from "@/adapters/memory/scenario/beats.ts";
import { AgentId, AgentRef } from "@/domain/ids.ts";
import { file, folder, host, mcp, type Ref } from "@/domain/ref.ts";

const DEV = "/Users/demo/Developer";
export const SHOP = `${DEV}/shop`;
export const PRICING = `${DEV}/shop-pricing`;
export const OPS = `${DEV}/ops`;
export const DOCS = `${DEV}/docs`;
export const SCRIPTS = `${DEV}/scripts`;
const API = `${SHOP}/apps/api`;
const WEB = `${SHOP}/apps/web`;
export const BUTTON = `${SHOP}/packages/ui/Button.tsx`;

const issue = (id: string): Ref => ({ _tag: "Subject", kind: "issue", id });
const root = (harness: string, thread: string) =>
  ({ _tag: "Agent", id: AgentRef(harness, thread, main) }) as const;

const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";
const CLAUDE_WINDOW = 200_000;

const explore = AgentId("explore");
const tests = AgentId("tests");
const ui = AgentId("ui");
const migrations = AgentId("migrations");

// A conversation resumed from an earlier one: fan-out, a failing sub-agent in a retry loop, and a shared file.
const billing: Script = {
  key: "billing",
  thread: { cwd: API, status: "busy", name: "billing-refactor" },
  age: 150,
  beats: (t) => [
    spawn(main, "billing-refactor", 0, null),
    beat(0, {
      _tag: "LinkMade",
      link: {
        kind: "resumed",
        from: root("claude", t("earlier")),
        to: root("claude", t("billing")),
        at: 0,
      },
    }),
    setup(main, 6_200, ["Agent", "Bash", "Read", "Edit"]),
    mode(main, 0, "permission", "auto"),
    mode(main, 0, "effort", "high"),
    skill(main, 1, "mise"),
    ctx(main, "Message", "Messages", 9_000),
    ctx(main, "File", "apps/api/src/billing", 14_000),
    ctx(main, "Tool", "Agent", 3_100),
    ...think(main, 0, 2),
    ...delegate(explore, "Explore", 2, 36),
    ...think(main, 36, 38),
    ...delegate(tests, "Tests", 38, 192),
    ...think(main, 58, 60),
    ...delegate(ui, "UI", 60),
    ...think(main, 118, 120),
    ...delegate(migrations, "Migrations", 120, 201),
    turn(main, 148, OPUS, 52_000, CLAUDE_WINDOW),
    turn(main, 205, OPUS, 58_000, CLAUDE_WINDOW),

    ...call(explore, "Grep", "invoice", 4, {
      end: 9,
      touch: [folder(`${API}/src/billing`)],
    }),
    ...call(explore, "Read", "invoice.ts", 10, {
      end: 14,
      touch: [file(`${API}/src/billing/invoice.ts`)],
    }),
    ...call(explore, "WebFetch", "stripe tax", 15, {
      end: 22,
      touch: [host("docs.stripe.com")],
    }),
    request(explore, 15, "docs.stripe.com", "WebFetch", "stripe tax"),
    turn(explore, 34, SONNET, 21_000, CLAUDE_WINDOW),

    ...call(tests, "Bash", "bun test billing", 40, {
      end: 55,
      fail: "3 tests failed",
      exit: 1,
    }),
    ...call(tests, "Bash", "bun test billing", 58, {
      end: 72,
      fail: "2 tests failed",
      exit: 1,
    }),
    ...call(tests, "Bash", "bun test billing", 75, {
      end: 90,
      fail: "2 tests failed",
      exit: 1,
    }),
    ...call(tests, "Bash", "bun test billing", 100, { end: 190, exit: 0 }),
    turn(tests, 100, HAIKU, 18_000, CLAUDE_WINDOW),

    ...call(ui, "Read", "Button.tsx", 62, {
      end: 64,
      touch: [file(BUTTON)],
    }),
    ...call(ui, "Edit", "Button.tsx", 66, {
      end: 70,
      touch: [file(BUTTON)],
      edit: { op: "modify", added: 12, removed: 3 },
    }),
    ...call(ui, "Edit", "Button.tsx", 160, {
      end: 165,
      touch: [file(BUTTON)],
      edit: { op: "modify", added: 4, removed: 4 },
    }),
    ...call(ui, "Bash", "bun run typecheck", 175),
    turn(ui, 70, SONNET, 24_000, CLAUDE_WINDOW),
    turn(ui, 168, SONNET, 30_000, CLAUDE_WINDOW),

    ...call(migrations, "Write", "0042_invoice_tax.sql", 123, {
      end: 124,
      touch: [file(`${API}/migrations/0042_invoice_tax.sql`)],
      edit: { op: "create", added: 26, removed: 0 },
    }),
    ...call(migrations, "Bash", "bun run migrate", 125, { end: 199 }),
    turn(migrations, 130, SONNET, 15_000, CLAUDE_WINDOW),
  ],
  tasks: [
    task("todo", main, "Map the billing module", "done"),
    task("todo", main, "Fix the failing tests", "doing"),
    task("todo", main, "Share the Button changes", "doing"),
    task("todo", main, "Write the migration", "next"),
    task("queue", main, "also update the docs", "next"),
  ],
};

const earlier: Script = {
  key: "earlier",
  thread: { cwd: API, status: "past", name: "billing-spike" },
  age: 60,
  quiet: 1_200,
  beats: () => [
    spawn(main, "billing-spike", 0, null),
    ...call(main, "Read", "invoice.ts", 3, {
      end: 5,
      touch: [file(`${API}/src/billing/invoice.ts`)],
    }),
    turn(main, 50, SONNET, 30_000, CLAUDE_WINDOW),
    finish(main, 55),
  ],
};

// Forked from the billing thread: nearly full, a hook and a classifier each stopping a call, then a compaction.
const fork: Script = {
  key: "fork",
  thread: { cwd: API, status: "busy", name: "billing-docs" },
  age: 170,
  beats: (t) => [
    spawn(main, "billing-docs", 0, null),
    beat(0, {
      _tag: "LinkMade",
      link: {
        kind: "forked",
        from: root("claude", t("billing")),
        to: root("claude", t("fork")),
        at: 0,
      },
    }),
    mode(main, 0, "permission", "auto"),
    ctx(main, "Message", "Messages", 60_000),
    ctx(main, "File", "apps/api/docs", 80_000),
    ctx(main, "Tool", "Bash", 30_000),
    ...call(main, "Read", "billing.md", 20, {
      end: 24,
      touch: [file(`${API}/docs/billing.md`)],
    }),
    ...call(main, "Bash", "git push --force origin feat/billing", 80, {
      end: 81,
      fail: "PreToolUse hook blocked: no force pushes",
    }),
    ...call(main, "Bash", "curl -s https://api.stripe.com/v1/charges", 120, {
      end: 121,
      fail: "Denied by the auto mode classifier",
      deny: { by: "classifier" },
    }),
    ...call(main, "Read", "invoice.ts", 130, {
      end: 134,
      touch: [file(`${API}/src/billing/invoice.ts`)],
    }),
    turn(main, 150, OPUS, 188_000, CLAUDE_WINDOW),
    compact(main, 230),
    turn(main, 232, OPUS, 22_000, CLAUDE_WINDOW),
    ...call(main, "Edit", "billing.md", 240, {
      end: 246,
      touch: [file(`${API}/docs/billing.md`)],
      edit: { op: "modify", added: 31, removed: 9 },
    }),
  ],
};

// Codex asking before it installs a package, and again before it pushes.
const button: Script = {
  key: "button",
  thread: { cwd: WEB, status: "busy", name: "button-a11y" },
  age: 200,
  beats: () => [
    spawn(main, "button-a11y", 0, null),
    mode(main, 0, "approval", "on-request"),
    mode(main, 0, "sandbox", "workspace-write"),
    mode(main, 0, "effort", "high"),
    limit(main, 150, "5h", 0.91),
    limit(main, 150, "weekly", 0.42),
    setup(main, 5_800, []),
    ctx(main, "Message", "Messages", 12_000),
    ctx(main, "Tool", "shell", 31_000),
    ctx(main, "Tool", "apply_patch", 9_000),
    ...call(main, "shell", "rg -n Button packages/ui", 3, {
      end: 6,
      touch: [folder(`${SHOP}/packages/ui`)],
    }),
    ...call(main, "apply_patch", "Button.tsx", 60, {
      end: 64,
      touch: [file(BUTTON)],
      edit: { op: "modify", added: 18, removed: 4 },
    }),
    ...call(main, "shell", "pnpm test", 70, { end: 85, exit: 0 }),
    ...call(main, "shell", "pnpm add @radix-ui/react-slot", 160, {
      end: 262,
      ask: { until: 250 },
      touch: [host("registry.npmjs.org")],
    }),
    request(main, 160, "registry.npmjs.org", "shell", "pnpm add"),
    ...call(main, "apply_patch", "Button.tsx", 266, {
      end: 270,
      touch: [file(BUTTON)],
      edit: { op: "modify", added: 9, removed: 2 },
    }),
    ...call(main, "shell", "git push origin feat/billing", 340, {
      ask: {},
    }),
    turn(main, 195, "gpt-5.5", 92_000, 258_400),
    turn(main, 300, "gpt-5.5", 104_000, 258_400),
  ],
  tasks: [
    task("todo", main, "Find the Button source", "done"),
    task("todo", main, "Add aria props", "done"),
    task("todo", main, "Install the slot primitive", "doing"),
    task("goal", main, "Make the design system accessible", "doing"),
  ],
};

// A plan waiting for a person, in a worktree of the shop.
const pricing: Script = {
  key: "pricing",
  thread: { cwd: PRICING, status: "busy", name: "pricing-tiers" },
  age: 120,
  beats: () => [
    spawn(main, "pricing-tiers", 0, null),
    beat(0, {
      _tag: "LinkMade",
      link: {
        kind: "worktree-of",
        from: folder(PRICING),
        to: folder(SHOP),
        at: 0,
      },
    }),
    mode(main, 0, "approval", "on-request"),
    mode(main, 0, "effort", "medium"),
    ...call(main, "shell", "rg -n tier apps/web", 5, { end: 8 }),
    ...call(main, "shell", "sed -n 1,80p pricing.tsx", 12, {
      end: 14,
      touch: [file(`${PRICING}/apps/web/pricing.tsx`)],
    }),
    beat(100, {
      _tag: "PlanProposed",
      plan: {
        id: "tiers",
        agentId: main,
        at: 100,
        title: "Add usage tiers to the pricing page",
        steps: [
          "Add a Tier type and the three tiers",
          "Render tiers on the pricing page",
          "Cover the price calculation with tests",
          "Link the tiers from the billing page",
        ],
        status: "proposed",
      },
    }),
    beat(230, { _tag: "PlanDecided", id: "tiers", status: "approved" }),
    ...call(main, "apply_patch", "pricing.tsx", 236, {
      end: 242,
      touch: [file(`${PRICING}/apps/web/pricing.tsx`)],
      edit: { op: "modify", added: 44, removed: 6 },
    }),
    turn(main, 110, "gpt-5.5", 41_000, 258_400),
    turn(main, 244, "gpt-5.5", 58_000, 258_400),
  ],
};

// An MCP server whose login has expired; the agent keeps retrying.
const ops: Script = {
  key: "ops",
  thread: { cwd: OPS, status: "busy", name: "incident-482" },
  age: 90,
  beats: () => [
    spawn(main, "incident-482", 0, null),
    mode(main, 0, "permission", "default"),
    ...call(main, "mcp__github__get_issue", "get_issue #482", 5, {
      end: 9,
      touch: [mcp("github", "get_issue"), issue("482"), host("api.github.com")],
    }),
    ...call(main, "mcp__linear__search_issues", "search_issues", 20, {
      end: 22,
      fail: "401 Unauthorized: the OAuth token has expired",
    }),
    ...call(main, "mcp__linear__search_issues", "search_issues", 40, {
      end: 42,
      fail: "401 Unauthorized: the OAuth token has expired",
    }),
    ...call(main, "mcp__linear__search_issues", "search_issues", 60, {
      end: 62,
      fail: "401 Unauthorized: the OAuth token has expired",
    }),
    ...call(main, "mcp__linear__search_issues", "search_issues", 100, {
      end: 102,
      fail: "401 Unauthorized: the OAuth token has expired",
    }),
    ...call(main, "mcp__linear__search_issues", "search_issues", 140, {
      end: 142,
      fail: "401 Unauthorized: the OAuth token has expired",
    }),
    request(main, 20, "mcp.linear.app", "mcp", "search_issues"),
    turn(main, 142, SONNET, 36_000, CLAUDE_WINDOW),
  ],
};

// Harnesses that report less: no sub-agents, no tool names, no window.
const gemini: Script = {
  key: "gemini",
  thread: { cwd: DOCS, status: "busy", name: "readme-pass" },
  age: 80,
  beats: () => [
    spawn(main, "readme-pass", 0, null),
    ...think(main, 0, 4),
    ...call(main, "Read", "README.md", 5, {
      end: 8,
      touch: [file(`${DOCS}/README.md`)],
    }),
    ...call(main, "Edit", "README.md", 30, {
      end: 34,
      touch: [file(`${DOCS}/README.md`)],
      edit: { op: "modify", added: 14, removed: 5 },
    }),
    ...call(main, "Edit", "guide.md", 100, {
      end: 104,
      touch: [file(`${DOCS}/guide.md`)],
      edit: { op: "modify", added: 22, removed: 8 },
    }),
    ...call(main, "Bash", "mdl guide.md", 110),
    turn(main, 36, "gemini-3-pro", 14_000),
  ],
};

const aider: Script = {
  key: "aider",
  thread: { cwd: SCRIPTS, status: "busy", name: "refactor-cli" },
  age: 40,
  beats: () => [
    spawn(main, "refactor-cli", 0, null),
    ...call(main, "Edit", "cli.py", 10, {
      end: 14,
      touch: [file(`${SCRIPTS}/cli.py`)],
      edit: { op: "modify", added: 40, removed: 28 },
    }),
    ...call(main, "Edit", "cli.py", 70, {
      end: 74,
      touch: [file(`${SCRIPTS}/cli.py`)],
      edit: { op: "modify", added: 6, removed: 2 },
    }),
    turn(main, 20, SONNET, 24_000, CLAUDE_WINDOW),
    turn(main, 75, SONNET, 31_000, CLAUDE_WINDOW),
  ],
};

// A local model through an ordinary harness, reading the same file in a loop.
const local: Script = {
  key: "local",
  thread: { cwd: SCRIPTS, status: "busy", name: "embed-notes" },
  age: 100,
  beats: () => [
    spawn(main, "embed-notes", 0, null),
    ...think(main, 0, 3),
    ...[4, 20, 40, 60].flatMap((at) =>
      call(main, "Read", "notes.md", at, {
        end: at + 2,
        touch: [file(`${SCRIPTS}/notes.md`)],
      }),
    ),
    ...call(main, "Bash", "python embed.py notes", 80),
    turn(main, 8, "gpt-oss:20b", 12_000, 131_072),
  ],
};

// Silent for four minutes with nothing open.
const stalled: Script = {
  key: "stalled",
  thread: { cwd: SCRIPTS, status: "busy", name: "log-cleanup" },
  age: 300,
  beats: () => [
    spawn(main, "log-cleanup", 0, null),
    ...call(main, "Bash", "find logs -mtime +30", 10, { end: 16 }),
    turn(main, 60, HAIKU, 9_000, CLAUDE_WINDOW),
  ],
};

export const claudeStories: readonly Script[] = [
  billing,
  earlier,
  fork,
  ops,
  local,
  stalled,
];
export const codexStories: readonly Script[] = [button, pricing];
export const geminiStories: readonly Script[] = [gemini];
export const aiderStories: readonly Script[] = [aider];
