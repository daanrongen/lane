// A directory normalised to its git root.
export interface Workspace {
  readonly root: string;
  readonly branch?: string;
}

// Collapses `.` and `..`; a relative path is taken from `cwd`.
export const resolvePath = (cwd: string, path: string) => {
  const out: string[] = [];
  const full = path.startsWith("/") ? path : `${cwd}/${path}`;
  for (const part of full.split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return `/${out.join("/")}`;
};

export const within = (root: string, path: string) =>
  path === root || path.startsWith(root === "/" ? "/" : `${root}/`);

export const baseName = (path: string) => path.split("/").at(-1) || path;
