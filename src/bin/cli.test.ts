import { describe, expect, test } from "bun:test";
import { resolveMode, route } from "@/bin/cli.ts";

describe("resolveMode", () => {
  test("renders in terminals that speak kitty graphics", () => {
    expect(resolveMode([], { TERM_PROGRAM: "ghostty" })).toBe("terminal");
    expect(resolveMode([], { TERM_PROGRAM: "WezTerm" })).toBe("terminal");
    expect(resolveMode([], { KITTY_WINDOW_ID: "1" })).toBe("terminal");
    expect(resolveMode([], { TERM: "xterm-ghostty" })).toBe("terminal");
  });

  test("opens a window elsewhere", () => {
    expect(resolveMode([], {})).toBe("window");
    expect(resolveMode([], { TERM_PROGRAM: "tmux" })).toBe("window");
    expect(resolveMode([], { TERM_PROGRAM: "Apple_Terminal" })).toBe("window");
  });

  test("flags beat the env, the env beats detection", () => {
    const ghostty = { TERM_PROGRAM: "ghostty" };
    expect(resolveMode(["--window"], ghostty)).toBe("window");
    expect(resolveMode(["--terminal"], {})).toBe("terminal");
    expect(resolveMode([], { ...ghostty, LANE_MODE: "window" })).toBe("window");
    expect(resolveMode(["--terminal"], { LANE_MODE: "window" })).toBe(
      "terminal",
    );
  });

  test("ignores an unknown LANE_MODE", () => {
    expect(resolveMode([], { LANE_MODE: "nope" })).toBe("window");
  });
});

describe("route", () => {
  test("a command word runs headless, everything else opens the app", () => {
    expect(route(["threads", "ls"])).toBe("cli");
    expect(route(["status"])).toBe("cli");
    expect(route([])).toBe("gui");
    expect(route(["--terminal"])).toBe("gui");
    expect(route(["--window"])).toBe("gui");
  });
});
