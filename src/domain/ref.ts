import type { AgentRef } from "@/domain/ids.ts";

export type SubjectKind =
  | "issue"
  | "pr"
  | "ticket"
  | "branch"
  | "commit"
  | "url";

// Anything an act can touch.
export type Ref =
  | { readonly _tag: "File"; readonly path: string }
  | { readonly _tag: "Folder"; readonly path: string }
  | { readonly _tag: "Host"; readonly host: string }
  | { readonly _tag: "Mcp"; readonly server: string; readonly tool?: string }
  | { readonly _tag: "Skill"; readonly name: string }
  | {
      readonly _tag: "Subject";
      readonly kind: SubjectKind;
      readonly id: string;
    }
  | { readonly _tag: "Command"; readonly program: string }
  | { readonly _tag: "Model"; readonly id: string }
  | { readonly _tag: "Agent"; readonly id: AgentRef };

export const file = (path: string): Ref => ({ _tag: "File", path });
export const folder = (path: string): Ref => ({ _tag: "Folder", path });
export const host = (host: string): Ref => ({ _tag: "Host", host });
export const mcp = (server: string, tool?: string): Ref => ({
  _tag: "Mcp",
  server,
  tool,
});
export const skill = (name: string): Ref => ({ _tag: "Skill", name });
export const subject = (kind: SubjectKind, id: string): Ref => ({
  _tag: "Subject",
  kind,
  id,
});
export const command = (program: string): Ref => ({ _tag: "Command", program });

// Two refs name the same thing exactly when their keys match.
export const refKey = (r: Ref): string => {
  switch (r._tag) {
    case "File":
    case "Folder":
      return `${r._tag}:${r.path}`;
    case "Host":
      return `Host:${r.host}`;
    case "Mcp":
      return `Mcp:${r.server}`;
    case "Skill":
      return `Skill:${r.name}`;
    case "Subject":
      return `Subject:${r.kind}:${r.id}`;
    case "Command":
      return `Command:${r.program}`;
    case "Model":
      return `Model:${r.id}`;
    case "Agent":
      return `Agent:${r.id}`;
  }
};

// First word of a shell command, past env assignments and sudo.
export const programOf = (cmd: string): string | undefined =>
  cmd.split(/\s+/).find((w) => w && !/^[A-Za-z_]\w*=/.test(w) && w !== "sudo");
