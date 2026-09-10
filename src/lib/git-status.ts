import { isElectron } from "@/lib/electron";

export type GitFileStatus = {
  path: string;
  code: string;
  label: string;
};

export type GitStatus = {
  ok: boolean;
  branch?: string;
  files: GitFileStatus[];
  error?: string;
};

const CODE_LABEL: Record<string, string> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  "?": "untracked",
  "!": "ignored",
  U: "unmerged",
};

function labelFor(code: string) {
  const c = code.trim().slice(-1) || code.trim()[0] || "?";
  return (CODE_LABEL[c] ?? code.trim()) || "changed";
}

/** Ask Electron main for `git status` of the vault root (localhost-only automation). */
export async function fetchGitStatus(): Promise<GitStatus> {
  if (!isElectron() || !window.kleverDesktop?.gitStatus) {
    return { ok: false, files: [], error: "Git panel requires the desktop app." };
  }
  try {
    const res = await window.kleverDesktop.gitStatus();
    return res;
  } catch (e) {
    return { ok: false, files: [], error: e instanceof Error ? e.message : "Git failed" };
  }
}

export function parseGitPorcelain(stdout: string, branchLine?: string): GitStatus {
  const files: GitFileStatus[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    const filePath = line.slice(3).trim();
    if (!filePath) continue;
    files.push({ path: filePath, code: code.trim() || "?", label: labelFor(code) });
  }
  const branch = branchLine?.replace(/^##\s*/, "").split("...")[0]?.trim();
  return { ok: true, branch, files };
}
