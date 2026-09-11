import { noteToFile } from "@/lib/parse";
import type { FreeformBoard, FreeformObject, Note } from "@/types";

/** Dedicated test vault for Lattice. Never written over the live disk vault. */
export const GRAPH_FIXTURE_NAME = "Orchard";

export const GRAPH_FIXTURE_STARRED = ["welcome", "atlas", "north-star", "ada"];

const T = "2026-09-01T09:00:00.000Z";

function file(path: string, note: Omit<Note, "path">): [string, string] {
  return [path, noteToFile({ ...note, path })];
}

function folderIcon(icon: string) {
  return `---\nicon: ${icon}\n---\n`;
}

function page(
  id: string,
  title: string,
  body: string,
  extra: Partial<Note> & { props?: Record<string, unknown> } = {},
): Omit<Note, "path"> {
  const { props, tags, ...rest } = extra;
  return {
    id,
    title,
    body,
    type: "page",
    tags: tags ?? [],
    props: props ?? {},
    created: T,
    updated: T,
    ...rest,
  };
}

const PROJECTS_SCHEMA = [
  { key: "status", name: "Status", type: "select" as const, options: ["Seed", "Growing", "Harvest"] },
  { key: "area", name: "Area", type: "select" as const, options: ["Product", "Writing", "Research", "Ops"] },
  { key: "due", name: "Due", type: "date" as const },
  { key: "people", name: "People", type: "relation" as const, relationTo: "people" },
  { key: "related", name: "Related", type: "relation" as const },
];

const PROJECTS_VIEWS = [
  { id: "table", name: "Table", type: "table" as const },
  { id: "board", name: "Board", type: "board" as const, groupBy: "status" },
  { id: "gallery", name: "Gallery", type: "gallery" as const, cover: "page" as const, cardSize: "m" as const },
];

const PEOPLE_SCHEMA = [
  { key: "role", name: "Role", type: "select" as const, options: ["Collaborator", "Reader", "Muse"] },
  { key: "related", name: "Related", type: "relation" as const, relationTo: "projects" },
];

const PLACES_SCHEMA = [
  { key: "kind", name: "Kind", type: "select" as const, options: ["Studio", "Field", "Archive"] },
  { key: "includes", name: "Includes", type: "relation" as const },
];

const MEETINGS_SCHEMA = [
  { key: "date", name: "Date", type: "date" as const },
  { key: "attendees", name: "Attendees", type: "people" as const },
  { key: "status", name: "Status", type: "select" as const, options: ["Scheduled", "In progress", "Done"] },
];

const noteFiles: [string, string][] = [
  file(
    "Welcome.md",
    page(
      "welcome",
      "Welcome",
      `Orchard is a full garden for testing the lattice — pages, databases, boards, and the leftover shape of how they touch.

> Type \`[[\` to link. Open **Graph** with \`⌘⇧G\`. Filter edges: all / link / relation.

## Doors

- [[Atlas]] is the map
- [[Principles]] is the constitution
- [[Studio]] is the desk
- Track work in [[Projects]]
- People live in [[People]]
- Places in [[Places]]
- Meetings in [[Meetings]]
- Browse [[Library]] or compost in [[Compost]]
`,
      { icon: "✦", tags: ["orchard", "garden"], width: "l" },
    ),
  ),
  file(
    "Atlas.md",
    page(
      "atlas",
      "Atlas",
      `A map of this vault.

[[Welcome]] is the door. [[Principles]] holds the rules. [[Studio]] is where work sits.

## Clusters

- Product: [[North star]] · [[Roadmap]] · [[Quiet chrome]] · [[Lattice]] · [[Type garden]]
- Research: [[Field notes]] · [[Interviews]] · [[Sources]] · [[Trakk visit]]
- Writing: [[Voice]] · [[Paper over pixels]] · [[Files are the product]] · [[The leftover shape]]
- People: [[Ada]] · [[Nara]] · [[Jules]] · [[Remy]] · [[Io]] · [[Sol]]
- Places: [[Desk]] · [[Orchard]] · [[Trakk]] · [[Archive]]

See also [[Projects]] and [[Meetings]].
`,
      { icon: "○", tags: ["orchard", "research"], cover: "#cfc8b8" },
    ),
  ),
  file(
    "Principles.md",
    page(
      "principles",
      "Principles",
      `1. Files over databases. A note you cannot open in a text editor is a hostage.
2. Structure is optional until it is not. Use a [[Projects]] row when a page needs columns.
3. Links are cheaper than folders. Prefer wikilinks and #tags.
4. Quiet chrome. The page is the product — see [[Quiet chrome]].
5. AI drafts; you keep.

The north star still holds: Klever should feel like a notebook that learned databases.
`,
      { icon: "◇", tags: ["orchard", "writing"] },
    ),
  ),
  file(
    "Studio.md",
    page(
      "studio",
      "Studio",
      `The working room.

[[Ada]] keeps structure. [[Remy]] owns the lattice. [[Jules]] holds the roadmap.

Today the desk faces [[North star]] and [[Quiet chrome]]. The board [[Welcome]] opened onto [[Atlas]].

Related place: [[Desk]].
`,
      { icon: "⌂", tags: ["orchard", "ops", "design"] },
    ),
  ),
  file(
    "Library.md",
    page(
      "library",
      "Library",
      `Shelves, not a feed.

- [[Paper over pixels]]
- [[Files are the product]]
- [[The leftover shape]]
- [[Voice]]
- [[Sources]]

The [[Archive]] keeps what the library outgrows. [[Compost]] is the other direction.
`,
      { icon: "☰", tags: ["writing", "research"] },
    ),
  ),
  file(
    "Compost.md",
    page(
      "compost",
      "Compost",
      `Fragments before they pretend to be essays.

[[Field notes]] dumped here. [[Interviews]] too. [[Nara]] prefers the pile stay unsorted.

Something about Atlas without a bracket — the unlinked rail should still find it.

See [[Sources]] and [[Trakk visit]].
`,
      { icon: "♻", tags: ["research", "garden"] },
    ),
  ),
  file(
    "Voice.md",
    page(
      "voice",
      "Voice",
      `The page should sound like paper.

[[Principles]] first. Then [[Type garden]]. [[Ada]] edits for structure; [[Paper over pixels]] is the longer argument.

Part of the writing cluster on [[Atlas]].
`,
      { icon: "◌", tags: ["writing"], props: { partOf: ["principles"] } },
    ),
  ),

  file("Projects.database.md", {
    id: "projects",
    title: "Projects",
    type: "database",
    icon: "▤",
    tags: ["ops"],
    props: {},
    schema: PROJECTS_SCHEMA,
    views: PROJECTS_VIEWS,
    body: "Rows are notes that point back with `parent`. People and related columns draw relation edges on the lattice.",
    created: T,
    updated: T,
  }),
  file(
    "Projects/North star.md",
    page(
      "north-star",
      "North star",
      `Name the thing so it can be aimed at.

Klever should feel like a notebook that learned databases, not a database that learned notes.

See [[Principles]] and [[Atlas]]. [[Roadmap]] depends on this page. [[Quiet chrome]] is part of it. [[Lattice]] supports it.
`,
      {
        icon: "★",
        parent: "projects",
        tags: ["product"],
        cover: "#d9d3c4",
        props: {
          status: "Growing",
          area: "Product",
          due: "2026-09-28",
          people: ["ada", "jules"],
          related: ["principles", "roadmap"],
        },
      },
    ),
  ),
  file(
    "Projects/Field notes.md",
    page(
      "field-notes",
      "Field notes",
      `Collect fragments before they pretend to be essays.

Brain dump. Split. Link. Leave the rest.

The Atlas is filling in — mention it here without a link, then find it under Unlinked in the rail.

[[Interviews]] and [[Nara]] live nearby. Compost catches what this page drops.
`,
      {
        icon: "✎",
        parent: "projects",
        tags: ["research", "writing"],
        props: {
          status: "Seed",
          area: "Research",
          due: "2026-09-18",
          people: ["nara", "io"],
          related: ["interviews", "compost"],
        },
      },
    ),
  ),
  file(
    "Projects/Type garden.md",
    page(
      "type-garden",
      "Type garden",
      `Geist for the chrome. Instrument Serif for the page. Fira Code for metadata that should stay in the background.

[[Voice]] borrows this. [[Quiet chrome]] needs the same restraint. [[Ada]] signed off.
`,
      {
        parent: "projects",
        tags: ["writing", "design"],
        props: {
          status: "Harvest",
          area: "Writing",
          due: "2026-08-12",
          people: ["ada"],
          related: ["voice", "quiet-chrome"],
        },
      },
    ),
  ),
  file(
    "Projects/Quiet chrome.md",
    page(
      "quiet-chrome",
      "Quiet chrome",
      `The page is the product. Chrome stays quiet.

[[Principles]] #4. [[Type garden]] for type. [[Remy]] sketched the lattice around it.

This page is part of [[North star]].
`,
      {
        parent: "projects",
        tags: ["product", "design"],
        props: {
          status: "Growing",
          area: "Product",
          due: "2026-09-22",
          people: ["remy", "ada"],
          related: ["type-garden", "lattice"],
          partOf: ["north-star"],
        },
      },
    ),
  ),
  file(
    "Projects/Roadmap.md",
    page(
      "roadmap",
      "Roadmap",
      `What ships after the north star holds.

[[Jules]] owns the sequence. [[Shipping ritual]] is the gate. Depends on [[North star]].

Also: [[Lattice]] · [[Quiet chrome]] · [[Orchard site]]
`,
      {
        parent: "projects",
        tags: ["product", "ops"],
        props: {
          status: "Growing",
          area: "Product",
          due: "2026-10-04",
          people: ["ada", "jules", "sol"],
          related: ["north-star", "quiet-chrome", "shipping-ritual"],
          dependsOn: ["north-star"],
        },
      },
    ),
  ),
  file(
    "Projects/Lattice.md",
    page(
      "lattice",
      "Lattice",
      `The graph is the leftover shape of how you think.

Wikilinks, relation columns, tags. Boards are the other map — they do not become nodes.

[[Remy]] and [[Ada]]. Supports [[North star]]. Neighbors: [[Quiet chrome]] · [[Type garden]] · [[Atlas]]
`,
      {
        icon: "✶",
        parent: "projects",
        tags: ["product", "lattice"],
        props: {
          status: "Growing",
          area: "Product",
          due: "2026-09-30",
          people: ["remy", "ada"],
          related: ["north-star", "type-garden", "atlas"],
          supports: ["north-star"],
        },
      },
    ),
  ),
  file(
    "Projects/Shipping ritual.md",
    page(
      "shipping-ritual",
      "Shipping ritual",
      `A gate, not a dashboard.

[[Sol]] and [[Jules]]. Depends on [[Roadmap]]. Prep lives in [[Meetings]].
`,
      {
        parent: "projects",
        tags: ["ops"],
        props: {
          status: "Seed",
          area: "Ops",
          due: "2026-10-12",
          people: ["sol", "jules"],
          related: ["roadmap"],
          dependsOn: ["roadmap"],
        },
      },
    ),
  ),
  file(
    "Projects/Orchard site.md",
    page(
      "orchard-site",
      "Orchard site",
      `The public face of the garden.

[[Io]] and [[Nara]]. Related to [[North star]] and [[Voice]]. Place: [[Orchard]].
`,
      {
        parent: "projects",
        tags: ["product", "garden"],
        props: {
          status: "Seed",
          area: "Product",
          due: "2026-10-20",
          people: ["io", "nara"],
          related: ["north-star", "voice"],
        },
      },
    ),
  ),
  file(
    "Projects/Voice guide.md",
    page(
      "voice-guide",
      "Voice guide",
      `A shorter sibling of [[Voice]].

[[Ada]] keeps the sentences short. Inspired by [[Principles]] and [[Type garden]].
`,
      {
        parent: "projects",
        tags: ["writing"],
        props: {
          status: "Harvest",
          area: "Writing",
          due: "2026-08-20",
          people: ["ada"],
          related: ["voice", "type-garden"],
          inspiredBy: ["principles"],
        },
      },
    ),
  ),
  file(
    "Projects/Archive sweep.md",
    page(
      "archive-sweep",
      "Archive sweep",
      `What the [[Archive]] should keep. [[Sol]] is moving compost that has cooled.

Related: [[Library]] · [[Compost]]
`,
      {
        parent: "projects",
        tags: ["ops", "research"],
        props: {
          status: "Seed",
          area: "Ops",
          due: "2026-10-08",
          people: ["sol"],
          related: ["library", "compost"],
        },
      },
    ),
  ),

  file("People.database.md", {
    id: "people",
    title: "People",
    type: "database",
    icon: "▣",
    tags: ["people"],
    props: {},
    schema: PEOPLE_SCHEMA,
    views: [
      { id: "table", name: "Table", type: "table" },
      { id: "gallery", name: "Gallery", type: "gallery" },
    ],
    body: "",
    created: T,
    updated: T,
  }),
  file(
    "People/Ada.md",
    page(
      "ada",
      "Ada",
      `Reads for structure. Asks what the file is for.

Linked from [[North star]], [[Type garden]], [[Quiet chrome]], [[Roadmap]], [[Lattice]], [[Voice guide]].
`,
      {
        parent: "people",
        tags: ["people"],
        props: { role: "Collaborator", related: ["north-star", "type-garden", "quiet-chrome"] },
      },
    ),
  ),
  file(
    "People/Nara.md",
    page(
      "nara",
      "Nara",
      `Collects stray sentences. Patron saint of [[Field notes]] and [[Compost]].

Also on [[Orchard site]] and [[Interviews]].
`,
      {
        parent: "people",
        tags: ["people"],
        props: { role: "Muse", related: ["field-notes", "orchard-site"] },
      },
    ),
  ),
  file(
    "People/Jules.md",
    page(
      "jules",
      "Jules",
      `Holds the sequence. Owns [[Roadmap]] and the [[Shipping ritual]].

Sits with [[Ada]] on [[North star]].
`,
      {
        parent: "people",
        tags: ["people"],
        props: { role: "Collaborator", related: ["roadmap", "shipping-ritual", "north-star"] },
      },
    ),
  ),
  file(
    "People/Remy.md",
    page(
      "remy",
      "Remy",
      `Draws the leftover shape. [[Lattice]] and [[Quiet chrome]].

Studio neighbor of [[Ada]].
`,
      {
        parent: "people",
        tags: ["people"],
        props: { role: "Collaborator", related: ["lattice", "quiet-chrome"] },
      },
    ),
  ),
  file(
    "People/Io.md",
    page(
      "io",
      "Io",
      `Field and site. [[Field notes]] with [[Nara]]. [[Orchard site]] copy.

Went to [[Trakk]] for [[Interviews]].
`,
      {
        parent: "people",
        tags: ["people"],
        props: { role: "Reader", related: ["field-notes", "orchard-site"] },
      },
    ),
  ),
  file(
    "People/Sol.md",
    page(
      "sol",
      "Sol",
      `Ops and gates. [[Shipping ritual]] · [[Archive sweep]] · [[Roadmap]].
`,
      {
        parent: "people",
        tags: ["people"],
        props: { role: "Collaborator", related: ["shipping-ritual", "archive-sweep"] },
      },
    ),
  ),

  file("Places.database.md", {
    id: "places",
    title: "Places",
    type: "database",
    icon: "lucide:map-pin",
    tags: ["ops"],
    props: {},
    schema: PLACES_SCHEMA,
    views: [
      { id: "table", name: "Table", type: "table" },
      { id: "gallery", name: "Gallery", type: "gallery" },
    ],
    body: "Rooms the work happens in. Includes-columns become relation edges.",
    created: T,
    updated: T,
  }),
  file(
    "Places/Desk.md",
    page(
      "desk",
      "Desk",
      `Where [[Studio]] actually sits. Morning notes land in Daily.
`,
      {
        parent: "places",
        tags: ["ops"],
        props: { kind: "Studio", includes: ["studio", "welcome"] },
      },
    ),
  ),
  file(
    "Places/Orchard.md",
    page(
      "orchard-place",
      "Orchard",
      `The garden the vault is named for.

[[Studio]] and [[North star]] belong here. [[Orchard site]] is the public gate.
`,
      {
        parent: "places",
        tags: ["garden"],
        props: { kind: "Studio", includes: ["studio", "north-star", "orchard-site"] },
      },
    ),
  ),
  file(
    "Places/Trakk.md",
    page(
      "trakk",
      "Trakk",
      `Field site. [[Trakk visit]] and [[Interviews]] happened here. [[Io]] went.
`,
      {
        parent: "places",
        tags: ["research"],
        props: { kind: "Field", includes: ["trakk-visit", "interviews"] },
      },
    ),
  ),
  file(
    "Places/Archive.md",
    page(
      "archive",
      "Archive",
      `Cool storage. [[Library]] overflow and [[Compost]] that has settled. [[Archive sweep]] is the current pass.
`,
      {
        parent: "places",
        tags: ["ops"],
        props: { kind: "Archive", includes: ["library", "compost", "archive-sweep"] },
      },
    ),
  ),

  file("Meetings.database.md", {
    id: "meetings",
    title: "Meetings",
    type: "database",
    icon: "lucide:audio-lines",
    tags: ["meeting"],
    props: {},
    schema: MEETINGS_SCHEMA,
    views: [
      { id: "list", name: "List", type: "list", sorts: [{ key: "date", dir: "desc" }] },
      { id: "table", name: "Table", type: "table" },
      { id: "calendar", name: "Calendar", type: "calendar", dateProp: "date" },
    ],
    body: "",
    created: T,
    updated: T,
  }),
  file(
    "Meetings/Weekly standup.md",
    page(
      "weekly-standup",
      "Weekly standup",
      `- Ship the meetings hub
- Confirm who owns the north star copy — see [[North star]]
- [[Lattice]] status from [[Remy]]
`,
      {
        icon: "lucide:audio-lines",
        parent: "meetings",
        tags: ["meeting"],
        props: {
          date: "2026-09-08",
          attendees: ["Ada", "Nara", "Jules", "Remy"],
          status: "Done",
          kleverKind: "meeting",
        },
      },
    ),
  ),
  file(
    "Meetings/North star review.md",
    page(
      "north-star-review",
      "North star review",
      `Prep: read [[North star]] and [[Principles]] before the call.

Keep meeting notes as pages in [[Meetings]], with transcription on the page.
`,
      {
        icon: "lucide:audio-lines",
        parent: "meetings",
        tags: ["meeting", "product"],
        props: {
          date: "2026-08-28",
          attendees: ["Ada", "Jules"],
          status: "Done",
          kleverKind: "meeting",
        },
      },
    ),
  ),
  file(
    "Meetings/1-1 with Ada.md",
    page(
      "ada-1-1",
      "1:1 with Ada",
      `- What should Meetings feel like on a Tuesday?
- [[Voice guide]] harvest — still hold?
`,
      {
        icon: "lucide:audio-lines",
        parent: "meetings",
        tags: ["meeting"],
        props: {
          date: "2026-09-02",
          attendees: ["Ada"],
          status: "Done",
          kleverKind: "meeting",
        },
      },
    ),
  ),
  file(
    "Meetings/Design critique.md",
    page(
      "design-critique",
      "Design critique",
      `[[Quiet chrome]] and [[Type garden]] on the wall. [[Remy]] walked [[Lattice]]. [[Ada]] cut two labels.
`,
      {
        icon: "lucide:audio-lines",
        parent: "meetings",
        tags: ["meeting", "design"],
        props: {
          date: "2026-09-04",
          attendees: ["Ada", "Remy", "Jules"],
          status: "Done",
          kleverKind: "meeting",
        },
      },
    ),
  ),
  file(
    "Meetings/Research debrief.md",
    page(
      "research-debrief",
      "Research debrief",
      `[[Field notes]] + [[Interviews]] + [[Trakk visit]]. [[Nara]] and [[Io]] brought [[Sources]].
`,
      {
        icon: "lucide:audio-lines",
        parent: "meetings",
        tags: ["meeting", "research"],
        props: {
          date: "2026-09-05",
          attendees: ["Nara", "Io"],
          status: "Done",
          kleverKind: "meeting",
        },
      },
    ),
  ),
  file(
    "Meetings/Shipping gate.md",
    page(
      "shipping-gate",
      "Shipping gate",
      `[[Shipping ritual]] for [[Roadmap]]. [[Sol]] chairs. [[Jules]] brings the list.
`,
      {
        icon: "lucide:audio-lines",
        parent: "meetings",
        tags: ["meeting", "ops"],
        props: {
          date: "2026-09-11",
          attendees: ["Sol", "Jules", "Ada"],
          status: "Scheduled",
          kleverKind: "meeting",
        },
      },
    ),
  ),

  file(
    "Essays/Paper over pixels.md",
    page(
      "paper-over-pixels",
      "Paper over pixels",
      `Screens want to look like tools. This garden wants to look like paper.

References [[Principles]] and [[Type garden]]. Neighbor of [[Files are the product]].
`,
      { tags: ["writing"], props: { references: ["principles"], related: ["type-garden"] } },
    ),
  ),
  file(
    "Essays/Files are the product.md",
    page(
      "files-are-the-product",
      "Files are the product",
      `If you cannot open it in a text editor, it is a hostage.

[[Principles]] #1. [[Library]] keeps the argument. [[The leftover shape]] is the sequel.
`,
      { tags: ["writing"], props: { references: ["principles"] } },
    ),
  ),
  file(
    "Essays/The leftover shape.md",
    page(
      "leftover-shape",
      "The leftover shape",
      `The graph is what remains after you have linked.

Inspired by [[Principles]] and [[Lattice]]. See [[Atlas]] for the current shape.
`,
      { tags: ["writing", "lattice"], props: { inspiredBy: ["principles", "lattice"] } },
    ),
  ),

  file(
    "Research/Interviews.md",
    page(
      "interviews",
      "Interviews",
      `Talks at [[Trakk]] with [[Io]] and [[Nara]].

Feeds [[Field notes]]. Cited in [[Sources]]. Debrief: [[Research debrief]].
`,
      { tags: ["research"], props: { related: ["field-notes", "sources"] } },
    ),
  ),
  file(
    "Research/Sources.md",
    page(
      "sources",
      "Sources",
      `A shelf of what we stole from.

[[Library]] · [[Interviews]] · [[Compost]]
`,
      { tags: ["research"], props: { related: ["library", "interviews"] } },
    ),
  ),
  file(
    "Research/Trakk visit.md",
    page(
      "trakk-visit",
      "Trakk visit",
      `A day at [[Trakk]]. [[Io]] took notes that became [[Interviews]].

The place includes this page.
`,
      { tags: ["research"], props: { related: ["trakk", "interviews"] } },
    ),
  ),

  ...[
    ["2026-09-01", "Opened [[Welcome]] and [[Studio]]. The desk felt like a place."],
    ["2026-09-02", "[[North star]] with [[Ada]]. The sentence still holds."],
    ["2026-09-03", "[[Field notes]] with [[Nara]]. Compost grew."],
    ["2026-09-04", "[[Lattice]] and [[Quiet chrome]]. Critique in the afternoon."],
    ["2026-09-05", "[[Research debrief]] — [[Interviews]] are enough."],
    ["2026-09-06", "Wrote [[The leftover shape]]. Linked [[Atlas]]."],
    ["2026-09-07", "[[Roadmap]] with [[Jules]]. Shipping gate next week."],
    ["2026-09-08", "Standup. [[Atlas]] looks like a garden. [[Compost]] can wait."],
  ].map(([day, body]) =>
    file(
      `Daily/${day}.md`,
      page(`daily-${day}`, day, `${body}\n\n#daily\n`, {
        tags: ["daily"],
        font: "mono",
        width: "s",
        created: `${day}T08:00:00.000Z`,
        updated: `${day}T08:00:00.000Z`,
      }),
    ),
  ),

  file(
    "Lost receipt.md",
    page(
      "lost-receipt",
      "Lost receipt",
      `A page with no links and no relations. An isolate on the lattice — useful for empty-neighborhood checks.
`,
      { tags: ["ops"] },
    ),
  ),
  file(
    "Parking lot.md",
    page(
      "parking-lot",
      "Parking lot",
      `Ideas that did not earn a link yet. Another isolate, tagged so the tag node still has a neighbor.
`,
      { tags: ["ops"] },
    ),
  ),
];

export const GRAPH_FIXTURE_FILES: Record<string, string> = {
  ...Object.fromEntries(noteFiles),
  "Daily/.klever-folder.md": folderIcon("lucide:notebook-pen"),
  "Projects/.klever-folder.md": folderIcon("lucide:layout-grid"),
  "People/.klever-folder.md": folderIcon("lucide:users"),
  "Meetings/.klever-folder.md": folderIcon("lucide:audio-lines"),
  "Essays/.klever-folder.md": folderIcon("lucide:book-open"),
  "Research/.klever-folder.md": folderIcon("lucide:search"),
  "Places/.klever-folder.md": folderIcon("lucide:map-pin"),
};

function mention(
  id: string,
  noteId: string,
  title: string,
  x: number,
  y: number,
  kind: "page" | "database" = "page",
  z = 1,
): FreeformObject {
  return { id, type: "mention", x, y, w: 240, h: 56, z, noteId, title, kind };
}

function sticky(id: string, text: string, x: number, y: number, color: string, z = 0): FreeformObject {
  return { id, type: "sticky", x, y, w: 180, h: 160, z, text, color };
}

export const GRAPH_FIXTURE_BOARDS: FreeformBoard[] = [
  {
    id: "studio-map",
    title: "Studio map",
    dotted: true,
    camera: { x: 40, y: 20, zoom: 1 },
    updated: T,
    objects: [
      sticky("sm-s1", "The working room", 40, 40, "amber"),
      mention("sm-welcome", "welcome", "Welcome", 280, 48),
      mention("sm-atlas", "atlas", "Atlas", 560, 48),
      mention("sm-studio", "studio", "Studio", 280, 160),
      mention("sm-north", "north-star", "North star", 560, 160),
      mention("sm-ada", "ada", "Ada", 280, 272),
      mention("sm-projects", "projects", "Projects", 560, 272, "database"),
    ],
    connections: [
      { id: "sm-c1", from: "sm-welcome", to: "sm-atlas" },
      { id: "sm-c2", from: "sm-studio", to: "sm-north" },
      { id: "sm-c3", from: "sm-ada", to: "sm-north" },
      { id: "sm-c4", from: "sm-projects", to: "sm-north" },
    ],
  },
  {
    id: "sprint",
    title: "Sprint",
    dotted: true,
    camera: { x: 0, y: 0, zoom: 1 },
    updated: T,
    objects: [
      sticky("sp-s1", "What ships", 40, 40, "sage"),
      mention("sp-north", "north-star", "North star", 280, 48),
      mention("sp-road", "roadmap", "Roadmap", 560, 48),
      mention("sp-lat", "lattice", "Lattice", 280, 160),
      mention("sp-quiet", "quiet-chrome", "Quiet chrome", 560, 160),
      mention("sp-ship", "shipping-ritual", "Shipping ritual", 420, 272),
    ],
    connections: [
      { id: "sp-c1", from: "sp-north", to: "sp-road" },
      { id: "sp-c2", from: "sp-north", to: "sp-lat" },
      { id: "sp-c3", from: "sp-north", to: "sp-quiet" },
      { id: "sp-c4", from: "sp-road", to: "sp-ship" },
    ],
  },
  {
    id: "research-wall",
    title: "Research wall",
    dotted: true,
    camera: { x: 0, y: 0, zoom: 1 },
    updated: T,
    objects: [
      sticky("rw-s1", "Field pile", 40, 40, "celadon"),
      mention("rw-field", "field-notes", "Field notes", 280, 48),
      mention("rw-int", "interviews", "Interviews", 560, 48),
      mention("rw-src", "sources", "Sources", 280, 160),
      mention("rw-nara", "nara", "Nara", 560, 160),
      mention("rw-compost", "compost", "Compost", 280, 272),
      mention("rw-trakk", "trakk-visit", "Trakk visit", 560, 272),
    ],
    connections: [
      { id: "rw-c1", from: "rw-field", to: "rw-int" },
      { id: "rw-c2", from: "rw-int", to: "rw-src" },
      { id: "rw-c3", from: "rw-nara", to: "rw-field" },
      { id: "rw-c4", from: "rw-compost", to: "rw-field" },
    ],
  },
];
