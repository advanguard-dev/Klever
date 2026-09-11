export const BETA_HREF =
  "https://github.com/advanguard-dev/Klever/issues/new?title=Beta%20access%20request&body=Mac%20model%20%28Apple%20silicon%29%3A%0AHow%20you%20plan%20to%20use%20Klever%3A%0A";
export const GITHUB_HREF = "https://github.com/advanguard-dev/Klever";
export const VERSION = "0.1.0-beta.1";

export const copy = {
  eyebrow: "Local · Markdown · Private",
  headline: "A garden on disk.",
  deck: "Notes, databases, tags, and a graph. Files stay on this machine. Nothing leaves unless you send it to a model you choose.",
  principle: "A note you cannot open in a text editor is a hostage.",
  ai: "AI drafts; you keep.",
  beta: "Request beta access",
  github: "GitHub",
  macLine: "Private beta · Apple silicon · 0.1.0-beta.1",
  vaultLead:
    "Point Klever at a folder. The files are yours — the same files Obsidian, git, and a text editor already understand.",
  privacy: "Nothing leaves the machine unless you send it.",
  privacyBody:
    "Work stays on disk. Optional models are a choice you make, not a default that phones home.",
  privacyNoteTitle: "Privacy note",
  privacyBullets: [
    "Your vault is a folder of Markdown (and related) files on your Mac. Klever does not run a cloud sync service.",
    "There is no Klever account. App preferences stay in local browser storage / IndexedDB on this device.",
    "Remote AI is opt-in per workspace. When enabled, only the text you send for that feature leaves the machine — to the model provider you configure (e.g. DeepSeek).",
    "Local AI mode uses on-device heuristics and speech tools. No model API calls.",
    "We do not ship analytics or tracking SDKs in the desktop app or this site.",
  ] as const,
  welcomeType:
    "Klever is a local garden. Notes are markdown. Databases are markdown. The graph is the leftover shape of how you think.\n\nWrite in [[Principles]]\nTrack work in [[Projects]]",
};

export const shortcuts = [
  { keys: "⌘K", label: "search" },
  { keys: "⌘E", label: "block / present" },
  { keys: "⌘⇧T", label: "today’s note" },
  { keys: "⌘⇧D", label: "brain dump" },
  { keys: "⌘⇧G", label: "graph" },
] as const;

export type LatticeKind = "page" | "database" | "tag";

export type LatticeNode = {
  id: string;
  title: string;
  kind: LatticeKind;
};

export type LatticeEdge = {
  source: string;
  target: string;
  kind: "link" | "tag";
};

export const latticeNodes: LatticeNode[] = [
  { id: "welcome", title: "Welcome", kind: "page" },
  { id: "principles", title: "Principles", kind: "page" },
  { id: "projects", title: "Projects", kind: "database" },
  { id: "people", title: "People", kind: "database" },
  { id: "atlas", title: "Atlas", kind: "page" },
  { id: "tag-klever", title: "#klever", kind: "tag" },
  { id: "tag-writing", title: "#writing", kind: "tag" },
  { id: "tag-research", title: "#research", kind: "tag" },
];

export const latticeEdges: LatticeEdge[] = [
  { source: "welcome", target: "principles", kind: "link" },
  { source: "welcome", target: "projects", kind: "link" },
  { source: "welcome", target: "people", kind: "link" },
  { source: "welcome", target: "atlas", kind: "link" },
  { source: "principles", target: "projects", kind: "link" },
  { source: "atlas", target: "principles", kind: "link" },
  { source: "atlas", target: "projects", kind: "link" },
  { source: "atlas", target: "people", kind: "link" },
  { source: "welcome", target: "tag-klever", kind: "tag" },
  { source: "principles", target: "tag-klever", kind: "tag" },
  { source: "principles", target: "tag-writing", kind: "tag" },
  { source: "atlas", target: "tag-research", kind: "tag" },
];

export const graphDescription =
  "Sample vault graph. Pages Welcome, Principles, and Atlas link to databases Projects and People. Tags #klever, #writing, and #research hang off the pages they mark.";

export const vaultFiles = ["Welcome.md", "Principles.md", "Projects.database.md"] as const;
