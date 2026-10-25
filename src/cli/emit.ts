import { Console, Effect } from "effect";
import { CliError } from "@/cli/options.ts";
import { type Format, type Out, pickFormat, render } from "@/cli/render.ts";

export interface Printing {
  readonly format?: Format;
  readonly json: boolean;
  readonly noHeader: boolean;
}

const failure = (e: unknown) =>
  e instanceof CliError
    ? e
    : new CliError({
        message: e instanceof Error ? e.message : String(e),
        code: 1,
      });

// Prints a command's answer and sets the exit status; a failure goes to stderr.
export const emit = <E, R>(
  o: Printing,
  answer: Effect.Effect<Out, E, R>,
  exit: (out: Out) => number = () => 0,
) =>
  answer.pipe(
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
        const text = render(
          out,
          pickFormat(o, process.stdout.isTTY === true),
          !o.noHeader,
        );
        return (text ? Console.log(text) : Effect.void).pipe(
          Effect.andThen(
            Effect.sync(() => {
              process.exitCode = exit(out);
            }),
          ),
        );
      },
    }),
  );
