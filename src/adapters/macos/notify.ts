const SCRIPT = [
  "on run argv",
  "display notification (item 2 of argv) with title (item 1 of argv)",
  "end run",
];

// Arguments travel as argv, so no text is ever part of the script.
export const notify = (title: string, body: string) => {
  Bun.spawn(["osascript", ...SCRIPT.flatMap((l) => ["-e", l]), title, body], {
    stdout: "ignore",
    stderr: "ignore",
  });
};
