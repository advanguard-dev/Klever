export const DEMO_FILES: Record<string, string> = {
  "Welcome.md": `---
id: welcome
title: Welcome
icon: ✦
tags:
  - klever
created: 2026-08-14T09:00:00.000Z
updated: 2026-08-14T09:00:00.000Z
width: l
---

Klever is a local garden. Notes are markdown. Databases are markdown. The graph is the leftover shape of how you think.

> [!note]
> Type \`[[\` to link, \`/\` for blocks, \`⌘⇧T\` for today. Hover a wikilink to peek.

Open the command palette with \`⌘K\`. Capture a mess with **Brain dump**. Take notes in **Meetings**. See the lattice in **Graph**.

## Start here

- Write in [[Principles]]
- Track work in [[Projects]]
- People live in [[People]]
- Follow a thread through [[Atlas]]

Everything stays on this machine. Point Klever at a folder and the files are yours — the same files Obsidian, git, and a text editor already understand.
`,

  "Principles.md": `---
id: principles
title: Principles
icon: ◇
tags:
  - klever
  - writing
created: 2026-08-14T09:05:00.000Z
updated: 2026-08-14T09:05:00.000Z
---

1. Files over databases. A note you cannot open in a text editor is a hostage.
2. Structure is optional until it is not. Use a [[Projects]] row when a page needs columns.
3. Links are cheaper than folders. Prefer \`[[wikilinks]]\` and #tags.
4. Quiet chrome. The page is the product.
5. AI drafts; you keep.
`,

  "Atlas.md": `---
id: atlas
title: Atlas
icon: ○
tags:
  - research
created: 2026-08-14T09:10:00.000Z
updated: 2026-08-14T09:10:00.000Z
cover: "#cfc8b8"
---

A map of this vault.

[[Welcome]] is the door. [[Principles]] is the constitution. [[Projects]] holds active work. [[People]] are the edges between ideas.

![[Principles]]

Related: [[North star]] · [[Field notes]]
`,

  "Projects.database.md": `---
id: projects
title: Projects
type: database
icon: ▤
tags:
  - work
created: 2026-08-14T09:12:00.000Z
updated: 2026-08-14T09:12:00.000Z
schema:
  - key: status
    name: Status
    type: select
    options:
      - Seed
      - Growing
      - Harvest
  - key: area
    name: Area
    type: select
    options:
      - Product
      - Writing
      - Research
  - key: due
    name: Due
    type: date
  - key: people
    name: People
    type: relation
    relationTo: people
  - key: related
    name: Related
    type: relation
  - key: stage
    name: Stage
    type: formula
    formula: 'if(prop("Status") == "Harvest", "Shipped", prop("Status"))'
  - key: team
    name: Team
    type: rollup
    rollup:
      relation: people
      property: title
      agg: count
views:
  - id: table
    name: Table
    type: table
  - id: board
    name: Board
    type: board
    groupBy: status
  - id: gallery
    name: Gallery
    type: gallery
    cover: page
    cardSize: m
  - id: card
    name: Cards
    type: card
    cover: page
    cardSize: m
  - id: list
    name: List
    type: list
  - id: calendar
    name: Calendar
    type: calendar
    dateProp: due
---

A database is a note with a schema. Rows are notes that point back with \`parent\`.
`,

  "Projects/North star.md": `---
id: north-star
title: North star
icon: ★
parent: projects
tags:
  - product
status: Growing
area: Product
due: 2026-08-28
people:
  - ada
related:
  - principles
created: 2026-08-14T09:20:00.000Z
updated: 2026-08-14T09:20:00.000Z
cover: "#d9d3c4"
comments:
  - id: c-north
    body: "@Ada does the north star still hold?"
    author: You
    created: 2026-08-14T10:00:00.000Z
---

Name the thing so it can be aimed at.

Klever should feel like a notebook that learned databases, not a database that learned notes.

See [[Principles]] and [[Atlas]].
`,

  "Projects/Field notes.md": `---
id: field-notes
title: Field notes
icon: ✎
parent: projects
tags:
  - research
  - writing
status: Seed
area: Research
due: 2026-09-02
people:
  - nara
created: 2026-08-14T09:22:00.000Z
updated: 2026-08-14T09:22:00.000Z
---

Collect fragments before they pretend to be essays.

Brain dump into Klever. Split. Link. Leave the rest.

The Atlas is filling in — mention it here without a link, then find it under Unlinked in the rail.
`,

  "Projects/Type garden.md": `---
id: type-garden
title: Type garden
parent: projects
tags:
  - writing
status: Harvest
area: Writing
due: 2026-08-12
people:
  - ada
created: 2026-08-14T09:24:00.000Z
updated: 2026-08-14T09:24:00.000Z
---

Geist for the chrome. Instrument Serif for the page. Fira Code for metadata that should stay in the background.
`,

  "People.database.md": `---
id: people
title: People
type: database
icon: ▣
schema:
  - key: role
    name: Role
    type: select
    options:
      - Collaborator
      - Reader
      - Muse
  - key: related
    name: Related
    type: relation
    relationTo: projects
  - key: projects
    name: Projects
    type: rollup
    rollup:
      relation: related
      property: title
      agg: count
  - key: label
    name: Label
    type: formula
    formula: 'concat(title, " · ", prop("Role"))'
views:
  - id: table
    name: Table
    type: table
  - id: gallery
    name: Gallery
    type: gallery
  - id: card
    name: Cards
    type: card
    cover: page
    cardSize: m
created: 2026-08-14T09:14:00.000Z
updated: 2026-08-14T09:14:00.000Z
---
`,

  "People/Ada.md": `---
id: ada
title: Ada
parent: people
role: Collaborator
related:
  - north-star
tags:
  - people
created: 2026-08-14T09:30:00.000Z
updated: 2026-08-14T09:30:00.000Z
---

Reads for structure. Asks what the file is for.

Linked from [[North star]].
`,

  "People/Nara.md": `---
id: nara
title: Nara
parent: people
role: Muse
related:
  - field-notes
tags:
  - people
created: 2026-08-14T09:32:00.000Z
updated: 2026-08-14T09:32:00.000Z
---

Collects stray sentences. Patron saint of [[Field notes]].
`,

  "Daily/2026-08-14.md": `---
id: daily-2026-08-14
title: 2026-08-14
tags:
  - daily
created: 2026-08-14T08:00:00.000Z
updated: 2026-08-14T08:00:00.000Z
font: mono
width: s
---

Morning: opened a blank vault and refused another cloud.

Afternoon: [[Atlas]] started to look like a place.

#daily
`,

  "Meetings.database.md": `---
id: meetings
title: Meetings
type: database
icon: lucide:audio-lines
schema:
  - key: date
    name: Date
    type: date
  - key: attendees
    name: Attendees
    type: people
  - key: status
    name: Status
    type: select
    options:
      - Scheduled
      - In progress
      - Done
views:
  - id: list
    name: List
    type: list
    sorts:
      - key: date
        dir: desc
    visible:
      - date
      - attendees
      - status
  - id: table
    name: Table
    type: table
    visible:
      - date
      - attendees
      - status
  - id: calendar
    name: Calendar
    type: calendar
    dateProp: date
created: 2026-08-14T09:40:00.000Z
updated: 2026-08-14T09:40:00.000Z
---
`,

  "Meetings/Weekly standup.md": `---
id: weekly-standup
title: Weekly standup
icon: lucide:audio-lines
parent: meetings
tags:
  - meeting
date: "2026-08-31"
attendees:
  - Ada
  - Nara
status: Scheduled
kleverKind: meeting
created: 2026-08-31T08:00:00.000Z
updated: 2026-08-31T08:00:00.000Z
---

- Ship the meetings hub
- Confirm who owns the north star copy
`,

  "Meetings/North star review.md": `---
id: north-star-review
title: North star review
icon: lucide:audio-lines
parent: meetings
tags:
  - meeting
  - product
date: "2026-08-28"
attendees:
  - Ada
status: Done
kleverKind: meeting
summary: |-
  ## Discussion

  The notebook-that-learned-databases line still holds. Klever should feel like a page, not a dashboard.

  ## Decisions

  Keep meeting notes as pages in a Meetings database, with transcription on the page.
actions:
  - title: Rewrite the Meetings empty state
    owner: Ada
created: 2026-08-28T15:00:00.000Z
updated: 2026-08-28T16:10:00.000Z
---

Prep: read [[North star]] and [[Principles]] before the call.
`,

  "Meetings/1-1 with Ada.md": `---
id: ada-1-1
title: 1:1 with Ada
icon: lucide:audio-lines
parent: meetings
tags:
  - meeting
date: "2026-09-02"
attendees:
  - Ada
status: Scheduled
kleverKind: meeting
created: 2026-08-31T09:00:00.000Z
updated: 2026-08-31T09:00:00.000Z
---

- What should Meetings feel like on a Tuesday?
`,
};
