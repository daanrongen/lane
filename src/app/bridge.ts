import {
  Effect,
  Exit,
  Fiber,
  type Layer,
  ManagedRuntime,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { type OpenRun, openRun } from "@/app/openRun.ts";
import { SessionsStore } from "@/app/SessionsStore.ts";
import type { Session } from "@/domain/session.ts";
import type { Harnesses } from "@/ports/Harness.ts";
import type { Store, UiPorts } from "@/ui/lib/ports.ts";

const store = <A>(ref: SubscriptionRef.SubscriptionRef<A>): Store<A> => ({
  get: () => SubscriptionRef.getUnsafe(ref),
  subscribe: (onChange) => {
    const fiber = Effect.runFork(
      Stream.runForEach(SubscriptionRef.changes(ref), () =>
        Effect.sync(onChange),
      ),
    );
    return () => void Effect.runFork(Fiber.interrupt(fiber));
  },
});

// Adapts the Effect app to the plain interface the UI consumes.
export const makeUiPorts = async <E>(
  layer: Layer.Layer<SessionsStore | Harnesses, E>,
): Promise<UiPorts> => {
  const runtime = ManagedRuntime.make(layer);
  const sessions = await runtime.runPromise(
    SessionsStore.use((s) => Effect.succeed(s.sessions)),
  );

  const open = async (session: Session) => {
    const scope = await Effect.runPromise(Scope.make());
    const opened: OpenRun = await runtime.runPromise(
      openRun(session).pipe(Effect.provideService(Scope.Scope, scope)),
    );
    return {
      run: store(opened.run),
      status: store(opened.status),
      close: () => void Effect.runFork(Scope.close(scope, Exit.void)),
    };
  };

  return { sessions: store(sessions), open };
};
