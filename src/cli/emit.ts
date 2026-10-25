import { Console, Effect } from "effect";
import { CliError } from "@/cli/options.ts";
import { type Format, type Out, pickFormat, render } from "@/cli/render.ts";

export interface Printing {
  readonly format?: Format;
  readonly json: boolean;
  readonly noHeader: boolean;
  readonly watch?: boolean;
  readonly every?: string;
}

const failure = (e: unknown) =>
  e instanceof CliError
    ? e
    : new CliError({
        message: e instanceof Error ? e.message : String(e),
        code: 1,
      });

const CLEAR = "\x1b[2J\x1b[H";

const interval = (every: string | undefined) => {
  const n = Number(every);
  return (Number.isFinite(n) && n > 0 ? n : 2) * 1000;
};

// Prints a command's answer and sets the exit status; a failure goes to stderr.
// With `watch` it reads again every few seconds, redrawing a terminal and appending when piped.
export const emit = <E, R>(
  o: Printing,
  answer: Effect.Effect<Out, E, R>,
  exit: (out: Out) => number = () => 0,
) => {
  const once = answer.pipe(
    Effect.matchEffect({
      onFailure: (e) => {
        const { message, code } = failure(e);
        return Console.error(`lane: ${message}`).pipe(
          Effect.andThen(
            Effect.sync(() => {
              process.exitCode = code;
            }),
          ),
        );
      },
      onSuccess: (out) => {
        const tty = process.stdout.isTTY === true;
        const text = render(out, pickFormat(o, tty), !o.noHeader);
        const shown = o.watch && tty ? `${CLEAR}${text}` : text;
        return (shown ? Console.log(shown) : Effect.void).pipe(
          Effect.andThen(
            Effect.sync(() => {
              process.exitCode = exit(out);
            }),
          ),
        );
      },
    }),
  );
  return o.watch
    ? Effect.forever(once.pipe(Effect.andThen(Effect.sleep(interval(o.every)))))
    : once;
};
