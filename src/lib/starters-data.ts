import { nid } from "@/lib/ids";
import type { Locale } from "@/lib/i18n";
import type {
  DbView,
  FreeformObject,
  SchemaProp,
} from "@/types";
import type { Starter, StarterCopy } from "@/lib/starter-types";

function both(en: StarterCopy, fr: StarterCopy): Record<Locale, StarterCopy> {
  return { en, fr };
}

function pick(locale: Locale, en: string, fr: string) {
  return locale === "fr" ? fr : en;
}

function statusSchema(locale: Locale, options: [string, string, string]): SchemaProp[] {
  return [
    { key: "status", name: pick(locale, "Status", "Statut"), type: "select", options: [...options] },
    { key: "due", name: pick(locale, "Due", "Échéance"), type: "date" },
  ];
}

function tableBoardCal(groupBy = "status", dateProp = "due"): DbView[] {
  return [
    { id: "table", name: "Table", type: "table" },
    { id: "board", name: "Board", type: "board", groupBy },
    { id: "calendar", name: "Calendar", type: "calendar", dateProp },
  ];
}

function text(x: number, y: number, z: number, value: string, fontSize = 28): FreeformObject {
  return {
    id: nid(),
    type: "text",
    x,
    y,
    z,
    w: Math.max(280, Math.min(520, value.length * (fontSize * 0.55))),
    h: fontSize + 20,
    text: value,
    fontSize,
    color: "ink",
    fontFamily: "serif",
  };
}

function sticky(x: number, y: number, z: number, value: string, color: string): FreeformObject {
  return {
    id: nid(),
    type: "sticky",
    x,
    y,
    z,
    w: 180,
    h: 140,
    text: value,
    color,
    fontSize: 14,
    fontFamily: "serif",
  };
}

function mind(x: number, y: number, z: number, value: string, parentId?: string): FreeformObject {
  return {
    id: nid(),
    type: "mind",
    x,
    y,
    z,
    w: 200,
    h: 64,
    text: value,
    parentId,
    fontSize: 14,
    color: "ink",
    fontFamily: "serif",
  };
}

function shape(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  value: string,
  fill: string,
): FreeformObject {
  return {
    id: nid(),
    type: "shape",
    x,
    y,
    z,
    w,
    h,
    shape: "roundrect",
    fill,
    stroke: "ink",
    strokeWidth: 1.5,
    strokeDash: "solid",
    text: value,
    showLabel: true,
    fontSize: 16,
    fontFamily: "sans",
    align: "center",
    valign: "middle",
  };
}

function sheet(x: number, y: number, z: number, cells: string[][]): FreeformObject {
  const rows = cells.length;
  const cols = Math.max(1, ...cells.map((r) => r.length));
  const grid = cells.map((row) => {
    const next = [...row];
    while (next.length < cols) next.push("");
    return next;
  });
  return {
    id: nid(),
    type: "table",
    x,
    y,
    z,
    w: Math.max(280, cols * 108 + 28),
    h: Math.max(140, rows * 36 + 44),
    cols,
    rows,
    cells: grid,
    headerRow: true,
    fontSize: 13,
    fontFamily: "sans",
    align: "left",
    valign: "middle",
  };
}

export const STARTERS: Starter[] = [
  {
    id: "blank-page",
    kind: "page",
    purpose: "write",
    theme: "work",
    icon: "lucide:file-text",
    blank: true,
    copy: both(
      { title: "Blank page", blurb: "An empty markdown page." },
      { title: "Page vide", blurb: "Une page markdown vide." },
    ),
    seed: { type: "page", body: () => "" },
  },
  {
    id: "blank-board",
    kind: "board",
    purpose: "create",
    theme: "studio",
    icon: "lucide:sticky-note",
    blank: true,
    copy: both(
      { title: "Blank board", blurb: "An empty freeform canvas." },
      { title: "Tableau vide", blurb: "Un canevas libre vide." },
    ),
    seed: { type: "board", build: () => ({ objects: [] }) },
  },
  {
    id: "blank-database",
    kind: "database",
    purpose: "track",
    theme: "work",
    icon: "lucide:database",
    blank: true,
    copy: both(
      { title: "Blank database", blurb: "Status, due date, and a table view." },
      { title: "Base vide", blurb: "Statut, échéance, et une vue tableau." },
    ),
    seed: {
      type: "database",
      viewType: "table",
      schema: (locale) =>
        statusSchema(locale, [
          pick(locale, "Inbox", "Boîte"),
          pick(locale, "Active", "En cours"),
          pick(locale, "Done", "Fait"),
        ]),
    },
  },
  {
    id: "meeting-notes",
    kind: "page",
    purpose: "meet",
    theme: "work",
    icon: "lucide:audio-lines",
    copy: both(
      { title: "Meeting notes", blurb: "Agenda, a decision table, and next actions." },
      { title: "Notes de réunion", blurb: "Ordre du jour, tableau de décisions, actions." },
    ),
    seed: {
      type: "page",
      tags: ["meeting"],
      body: (locale) =>
        pick(
          locale,
          `## Agenda

- 

## Notes

- 

## Decisions

| Decision | Owner | When |
| --- | --- | --- |
|  |  |  |

## Actions

- [ ] 

\`\`\`mermaid
flowchart LR
  Discuss --> Decide --> Act
\`\`\`
`,
          `## Ordre du jour

- 

## Notes

- 

## Décisions

| Décision | Responsable | Quand |
| --- | --- | --- |
|  |  |  |

## Actions

- [ ] 

\`\`\`mermaid
flowchart LR
  Discuter --> Décider --> Agir
\`\`\`
`,
        ),
    },
  },
  {
    id: "daily-journal",
    kind: "page",
    purpose: "write",
    theme: "personal",
    icon: "lucide:notebook-pen",
    copy: both(
      { title: "Daily journal", blurb: "Morning intent, log, and a one-line close." },
      { title: "Journal du jour", blurb: "Intention, log, et une ligne de clôture." },
    ),
    seed: {
      type: "page",
      tags: ["journal"],
      body: (locale) =>
        pick(
          locale,
          `## Intent

- 

## What happened

- 

## Close

One line.
`,
          `## Intention

- 

## Ce qui s’est passé

- 

## Clôture

Une ligne.
`,
        ),
    },
  },
  {
    id: "weekly-review",
    kind: "page",
    purpose: "plan",
    theme: "personal",
    icon: "lucide:calendar-days",
    copy: both(
      { title: "Weekly review", blurb: "Wins, misses, and next week in a small table." },
      { title: "Revue de semaine", blurb: "Réussites, manques, et la semaine suivante." },
    ),
    seed: {
      type: "page",
      tags: ["review"],
      body: (locale) =>
        pick(
          locale,
          `## Wins

- 

## Misses

- 

## Next week

| Focus | Why it matters | Done when |
| --- | --- | --- |
|  |  |  |
`,
          `## Réussites

- 

## Manques

- 

## Semaine prochaine

| Focus | Pourquoi | Fait quand |
| --- | --- | --- |
|  |  |  |
`,
        ),
    },
  },
  {
    id: "project-brief",
    kind: "page",
    purpose: "plan",
    theme: "work",
    icon: "lucide:target",
    copy: both(
      { title: "Project brief", blurb: "Aim, constraints, and a mermaid path to ship." },
      { title: "Brief projet", blurb: "Visée, contraintes, et un chemin jusqu’à la livraison." },
    ),
    seed: {
      type: "page",
      tags: ["project"],
      body: (locale) =>
        pick(
          locale,
          `## Aim

One sentence.

## Constraints

- 

## Timeline

| Milestone | When | Status |
| --- | --- | --- |
| Kickoff |  |  |
| Ship |  |  |

\`\`\`mermaid
flowchart LR
  Brief --> Build --> Ship
\`\`\`

When this has a home, link the row in the projects database: \`[[Projects]]\`.
`,
          `## Visée

Une phrase.

## Contraintes

- 

## Calendrier

| Jalon | Quand | Statut |
| --- | --- | --- |
| Lancement |  |  |
| Livraison |  |  |

\`\`\`mermaid
flowchart LR
  Brief --> Build --> Livrer
\`\`\`

Quand ce projet a une maison, lier la ligne dans la base : \`[[Projets]]\`.
`,
        ),
    },
  },
  {
    id: "decision-log",
    kind: "page",
    purpose: "plan",
    theme: "work",
    icon: "lucide:flag",
    copy: both(
      { title: "Decision log", blurb: "Context, options, and the call you made." },
      { title: "Journal de décisions", blurb: "Contexte, options, et le choix retenu." },
    ),
    seed: {
      type: "page",
      tags: ["decision"],
      body: (locale) =>
        pick(
          locale,
          `## Context

## Options

| Option | Upside | Cost |
| --- | --- | --- |
| A |  |  |
| B |  |  |

## Decision

## Follow-up

- [ ] 
`,
          `## Contexte

## Options

| Option | Gain | Coût |
| --- | --- | --- |
| A |  |  |
| B |  |  |

## Décision

## Suite

- [ ] 
`,
        ),
    },
  },
  {
    id: "reading-notes",
    kind: "page",
    purpose: "learn",
    theme: "research",
    icon: "lucide:book-open",
    copy: both(
      { title: "Reading notes", blurb: "Claim, quotes, and what you will do with it." },
      { title: "Notes de lecture", blurb: "Thèse, citations, et ce que vous en faites." },
    ),
    seed: {
      type: "page",
      tags: ["reading"],
      body: (locale) =>
        pick(
          locale,
          `## Source

Title — author

## Claim

## Quotes

> 

## Do with this

- [ ] Add to [[Reading list]] when you keep a database of titles.
`,
          `## Source

Titre — auteur

## Thèse

## Citations

> 

## En faire quelque chose

- [ ] Ajouter à [[Liste de lecture]] si vous tenez une base de titres.
`,
        ),
    },
  },
  {
    id: "recipe",
    kind: "page",
    purpose: "write",
    theme: "home",
    icon: "lucide:coffee",
    copy: both(
      { title: "Recipe", blurb: "Ingredients table and steps." },
      { title: "Recette", blurb: "Tableau d’ingrédients et étapes." },
    ),
    seed: {
      type: "page",
      tags: ["recipe"],
      body: (locale) =>
        pick(
          locale,
          `## Ingredients

| Amount | Item |
| --- | --- |
|  |  |

## Steps

1. 
`,
          `## Ingrédients

| Quantité | Ingrédient |
| --- | --- |
|  |  |

## Étapes

1. 
`,
        ),
    },
  },
  {
    id: "creative-brief",
    kind: "page",
    purpose: "create",
    theme: "studio",
    icon: "lucide:pen-line",
    copy: both(
      { title: "Creative brief", blurb: "Audience, tone, and a simple flow." },
      { title: "Brief créatif", blurb: "Public, ton, et un flux simple." },
    ),
    seed: {
      type: "page",
      tags: ["studio"],
      body: (locale) =>
        pick(
          locale,
          `## Audience

## Tone

## Must include

- 

\`\`\`mermaid
flowchart TD
  Insight --> Concept --> Craft --> Ship
\`\`\`
`,
          `## Public

## Ton

## Doit inclure

- 

\`\`\`mermaid
flowchart TD
  Insight --> Concept --> Forme --> Livrer
\`\`\`
`,
        ),
    },
  },
  {
    id: "project-hub",
    kind: "page",
    purpose: "plan",
    theme: "work",
    icon: "lucide:layers",
    copy: both(
      { title: "Project hub", blurb: "A page plus a projects database, linked." },
      { title: "Hub projet", blurb: "Une page plus une base projets, liées." },
    ),
    seed: {
      type: "pack",
      databaseIcon: "lucide:kanban",
      databaseTitle: (locale) => pick(locale, "Projects", "Projets"),
      viewType: "board",
      schema: (locale) => [
        {
          key: "status",
          name: pick(locale, "Status", "Statut"),
          type: "select",
          options: [
            pick(locale, "Seed", "Graine"),
            pick(locale, "Growing", "En cours"),
            pick(locale, "Harvest", "Récolte"),
          ],
        },
        {
          key: "area",
          name: pick(locale, "Area", "Domaine"),
          type: "select",
          options: [
            pick(locale, "Product", "Produit"),
            pick(locale, "Writing", "Écriture"),
            pick(locale, "Research", "Recherche"),
          ],
        },
        { key: "due", name: pick(locale, "Due", "Échéance"), type: "date" },
      ],
      views: tableBoardCal(),
      rows: (locale) => [
        {
          title: pick(locale, "North star", "Étoile polaire"),
          icon: "lucide:star",
          props: {
            status: pick(locale, "Growing", "En cours"),
            area: pick(locale, "Product", "Produit"),
          },
          body: pick(locale, "Name the thing so it can be aimed at.\n", "Nommer la chose pour pouvoir la viser.\n"),
        },
      ],
      pageBody: (locale, dbTitle) =>
        pick(
          locale,
          `# Project hub

This page is the brief. Rows live in the database below — edit them there, mention them here.

![[${dbTitle}]]

## Shape

\`\`\`mermaid
flowchart LR
  Hub --> ${dbTitle} --> Graph
\`\`\`

## Now

| Focus | Owner | Due |
| --- | --- | --- |
|  |  |  |
`,
          `# Hub projet

Cette page est le brief. Les lignes vivent dans la base ci-dessous.

![[${dbTitle}]]

## Forme

\`\`\`mermaid
flowchart LR
  Hub --> ${dbTitle} --> Graphe
\`\`\`

## Maintenant

| Focus | Responsable | Échéance |
| --- | --- | --- |
|  |  |  |
`,
        ),
    },
  },
  {
    id: "brainstorm",
    kind: "board",
    purpose: "create",
    theme: "studio",
    icon: "lucide:lightbulb",
    copy: both(
      { title: "Brainstorm", blurb: "Stickies and a keep / drop table." },
      { title: "Remue-méninges", blurb: "Pense-bêtes et un tableau garder / jeter." },
    ),
    seed: {
      type: "board",
      build: (locale) => {
        const title = pick(locale, "Brainstorm", "Remue-méninges");
        const keep = pick(locale, "Keep", "Garder");
        const drop = pick(locale, "Drop", "Jeter");
        const later = pick(locale, "Later", "Plus tard");
        const prompts = locale === "fr"
          ? ["Et si…", "Le contraire", "Le plus simple", "Trop cher", "Évident", "Interdit"]
          : ["What if…", "The opposite", "Simplest", "Too expensive", "Obvious", "Forbidden"];
        const colors = ["amber", "sage", "sky", "rose", "wisteria", "celadon"];
        const notes = prompts.map((p, i) =>
          sticky(96 + (i % 3) * 200, 120 + Math.floor(i / 3) * 160, i + 2, p, colors[i] ?? "amber"),
        );
        return {
          objects: [
            text(96, 36, 1, title),
            ...notes,
            sheet(720, 120, 10, [
              [keep, drop, later],
              ["", "", ""],
              ["", "", ""],
            ]),
          ],
        };
      },
    },
  },
  {
    id: "sprint-board",
    kind: "board",
    purpose: "plan",
    theme: "work",
    icon: "lucide:columns-3",
    copy: both(
      { title: "Sprint board", blurb: "To do, doing, done — as paper columns." },
      { title: "Sprint", blurb: "À faire, en cours, fait — en colonnes." },
    ),
    seed: {
      type: "board",
      build: (locale) => {
        const cols = locale === "fr"
          ? ["À faire", "En cours", "Fait"]
          : ["To do", "Doing", "Done"];
        const fills = ["paper", "sky", "sage"];
        const headers = cols.map((label, i) =>
          shape(96 + i * 260, 100, i + 2, 220, 56, label, fills[i] ?? "paper"),
        );
        const starters = locale === "fr" ? ["Définir le done", "Le plus risqué"] : ["Define done", "Riskiest slice"];
        return {
          objects: [
            text(96, 36, 1, pick(locale, "Sprint", "Sprint")),
            ...headers,
            sticky(112, 180, 6, starters[0] ?? "", "amber"),
            sticky(112, 340, 7, starters[1] ?? "", "clay"),
          ],
        };
      },
    },
  },
  {
    id: "moodboard",
    kind: "board",
    purpose: "create",
    theme: "studio",
    icon: "lucide:layers",
    copy: both(
      { title: "Moodboard", blurb: "Swatches and a tone line." },
      { title: "Moodboard", blurb: "Nuancier et une ligne de ton." },
    ),
    seed: {
      type: "board",
      build: (locale) => {
        const labels = locale === "fr"
          ? ["Os", "Paille", "Céladon", "Indigo"]
          : ["Bone", "Straw", "Celadon", "Indigo"];
        const fills = ["bone", "amber", "celadon", "indigo"];
        const chips = labels.map((label, i) =>
          shape(96 + i * 200, 140, i + 2, 172, 120, label, fills[i] ?? "paper"),
        );
        return {
          objects: [
            text(96, 40, 1, pick(locale, "Mood", "Ambiance")),
            ...chips,
            text(96, 300, 8, pick(locale, "Tone: quiet paper, one loud pigment.", "Ton : papier calme, un pigment fort."), 18),
          ],
        };
      },
    },
  },
  {
    id: "weekly-spread",
    kind: "board",
    purpose: "plan",
    theme: "personal",
    icon: "lucide:calendar-days",
    copy: both(
      { title: "Weekly spread", blurb: "Seven day stickies." },
      { title: "Semainier", blurb: "Sept pense-bêtes, un par jour." },
    ),
    seed: {
      type: "board",
      build: (locale) => {
        const days =
          locale === "fr"
            ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const colors = ["sky", "sage", "amber", "ochre", "rose", "wisteria", "paper"];
        const notes = days.map((day, i) => sticky(96 + i * 196, 120, i + 2, day, colors[i] ?? "paper"));
        return { objects: [text(96, 36, 1, pick(locale, "This week", "Cette semaine")), ...notes] };
      },
    },
  },
  {
    id: "research-map",
    kind: "board",
    purpose: "learn",
    theme: "research",
    icon: "lucide:network",
    copy: both(
      { title: "Research map", blurb: "A question in the middle, sources around it." },
      { title: "Carte de recherche", blurb: "Une question au centre, des sources autour." },
    ),
    seed: {
      type: "board",
      build: (locale) => {
        const q = pick(locale, "Question", "Question");
        const nodes =
          locale === "fr"
            ? ["Source", "Contre", "Preuve", "Suite"]
            : ["Source", "Counter", "Evidence", "Next"];
        const root = mind(380, 80, 1, q);
        const children = [
          mind(120, 260, 2, nodes[0] ?? "", root.id),
          mind(320, 300, 3, nodes[1] ?? "", root.id),
          mind(540, 300, 4, nodes[2] ?? "", root.id),
          mind(760, 260, 5, nodes[3] ?? "", root.id),
        ];
        return { objects: [root, ...children] };
      },
    },
  },
  {
    id: "tasks",
    kind: "database",
    purpose: "track",
    theme: "work",
    icon: "lucide:list-todo",
    copy: both(
      { title: "Tasks", blurb: "Inbox, active, done — table and board." },
      { title: "Tâches", blurb: "Boîte, en cours, fait — tableau et kanban." },
    ),
    seed: {
      type: "database",
      viewType: "board",
      views: tableBoardCal(),
      schema: (locale) => [
        ...statusSchema(locale, [
          pick(locale, "Inbox", "Boîte"),
          pick(locale, "Active", "En cours"),
          pick(locale, "Done", "Fait"),
        ]),
        {
          key: "priority",
          name: pick(locale, "Priority", "Priorité"),
          type: "select",
          options: [
            pick(locale, "Low", "Basse"),
            pick(locale, "Normal", "Normale"),
            pick(locale, "High", "Haute"),
          ],
        },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "Name the work", "Nommer le travail"),
          props: {
            status: pick(locale, "Inbox", "Boîte"),
            priority: pick(locale, "High", "Haute"),
          },
        },
      ],
    },
  },
  {
    id: "projects-db",
    kind: "database",
    purpose: "track",
    theme: "work",
    icon: "lucide:kanban",
    copy: both(
      { title: "Projects", blurb: "A few active efforts with status and due." },
      { title: "Projets", blurb: "Quelques efforts actifs, statut et échéance." },
    ),
    seed: {
      type: "database",
      viewType: "board",
      views: tableBoardCal(),
      schema: (locale) => [
        {
          key: "status",
          name: pick(locale, "Status", "Statut"),
          type: "select",
          options: [
            pick(locale, "Seed", "Graine"),
            pick(locale, "Growing", "En cours"),
            pick(locale, "Harvest", "Récolte"),
          ],
        },
        { key: "due", name: pick(locale, "Due", "Échéance"), type: "date" },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "First project", "Premier projet"),
          props: { status: pick(locale, "Seed", "Graine") },
        },
      ],
    },
  },
  {
    id: "people",
    kind: "database",
    purpose: "track",
    theme: "work",
    icon: "lucide:users",
    copy: both(
      { title: "People", blurb: "Names, role, and how you know them." },
      { title: "Personnes", blurb: "Noms, rôle, et comment vous vous connaissez." },
    ),
    seed: {
      type: "database",
      viewType: "table",
      views: [
        { id: "table", name: "Table", type: "table" },
        { id: "list", name: "List", type: "list" },
      ],
      schema: (locale) => [
        { key: "role", name: pick(locale, "Role", "Rôle"), type: "text" },
        { key: "org", name: pick(locale, "Org", "Org"), type: "text" },
        { key: "url", name: "URL", type: "url" },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "Ada", "Ada"),
          props: { role: pick(locale, "Collaborator", "Collaboratrice") },
        },
      ],
    },
  },
  {
    id: "content-calendar",
    kind: "database",
    purpose: "plan",
    theme: "studio",
    icon: "lucide:calendar-days",
    copy: both(
      { title: "Content calendar", blurb: "Pieces on a calendar, with channel and status." },
      { title: "Calendrier éditorial", blurb: "Pièces au calendrier, canal et statut." },
    ),
    seed: {
      type: "database",
      viewType: "calendar",
      views: tableBoardCal(),
      schema: (locale) => [
        {
          key: "status",
          name: pick(locale, "Status", "Statut"),
          type: "select",
          options: [
            pick(locale, "Idea", "Idée"),
            pick(locale, "Draft", "Brouillon"),
            pick(locale, "Published", "Publié"),
          ],
        },
        { key: "due", name: pick(locale, "Date", "Date"), type: "date" },
        {
          key: "channel",
          name: pick(locale, "Channel", "Canal"),
          type: "select",
          options: ["Site", "Note", "Talk"],
        },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "First piece", "Première pièce"),
          props: { status: pick(locale, "Idea", "Idée"), channel: "Note" },
        },
      ],
    },
  },
  {
    id: "reading-list",
    kind: "database",
    purpose: "track",
    theme: "research",
    icon: "lucide:library",
    copy: both(
      { title: "Reading list", blurb: "Wanted, reading, done — with a notes page per title." },
      { title: "Liste de lecture", blurb: "Envie, en cours, lu — une page par titre." },
    ),
    seed: {
      type: "database",
      viewType: "list",
      views: [
        { id: "list", name: "List", type: "list" },
        { id: "table", name: "Table", type: "table" },
        { id: "board", name: "Board", type: "board", groupBy: "status" },
      ],
      schema: (locale) => [
        {
          key: "status",
          name: pick(locale, "Status", "Statut"),
          type: "select",
          options: [
            pick(locale, "Wanted", "Envie"),
            pick(locale, "Reading", "En cours"),
            pick(locale, "Done", "Lu"),
          ],
        },
        { key: "author", name: pick(locale, "Author", "Auteur"), type: "text" },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "A book you mean to finish", "Un livre à finir"),
          props: { status: pick(locale, "Wanted", "Envie") },
        },
      ],
    },
  },
  {
    id: "habits",
    kind: "database",
    purpose: "track",
    theme: "personal",
    icon: "lucide:check-check",
    copy: both(
      { title: "Habits", blurb: "A short list you tick, not a streak app." },
      { title: "Habitudes", blurb: "Une courte liste à cocher, pas une appli de séries." },
    ),
    seed: {
      type: "database",
      viewType: "list",
      views: [
        { id: "list", name: "List", type: "list" },
        { id: "table", name: "Table", type: "table" },
      ],
      schema: (locale) => [
        { key: "done", name: pick(locale, "Today", "Aujourd’hui"), type: "checkbox" },
        { key: "cadence", name: pick(locale, "Cadence", "Cadence"), type: "text" },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "Walk", "Marcher"),
          props: { cadence: pick(locale, "Daily", "Quotidien"), done: false },
        },
      ],
    },
  },
  {
    id: "applications",
    kind: "database",
    purpose: "track",
    theme: "work",
    icon: "lucide:briefcase",
    copy: both(
      { title: "Applications", blurb: "Roles, stage, and a date." },
      { title: "Candidatures", blurb: "Postes, étape, et une date." },
    ),
    seed: {
      type: "database",
      viewType: "board",
      views: tableBoardCal(),
      schema: (locale) => [
        {
          key: "status",
          name: pick(locale, "Stage", "Étape"),
          type: "select",
          options: [
            pick(locale, "Wish", "Envie"),
            pick(locale, "Applied", "Envoyé"),
            pick(locale, "Talking", "Échange"),
            pick(locale, "Closed", "Clos"),
          ],
        },
        { key: "due", name: pick(locale, "Date", "Date"), type: "date" },
        { key: "url", name: "URL", type: "url" },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "A role worth a letter", "Un poste qui mérite une lettre"),
          props: { status: pick(locale, "Wish", "Envie") },
        },
      ],
    },
  },
  {
    id: "pantry",
    kind: "database",
    purpose: "track",
    theme: "home",
    icon: "lucide:package",
    copy: both(
      { title: "Pantry", blurb: "What you have, what you need." },
      { title: "Garde-manger", blurb: "Ce que vous avez, ce qu’il manque." },
    ),
    seed: {
      type: "database",
      viewType: "table",
      views: [
        { id: "table", name: "Table", type: "table" },
        { id: "board", name: "Board", type: "board", groupBy: "status" },
      ],
      schema: (locale) => [
        {
          key: "status",
          name: pick(locale, "Status", "Statut"),
          type: "select",
          options: [
            pick(locale, "Have", "En stock"),
            pick(locale, "Low", "Bientôt"),
            pick(locale, "Need", "À prendre"),
          ],
        },
        { key: "place", name: pick(locale, "Place", "Lieu"), type: "text" },
      ],
      rows: (locale) => [
        {
          title: pick(locale, "Coffee", "Café"),
          props: {
            status: pick(locale, "Have", "En stock"),
            place: pick(locale, "Kitchen", "Cuisine"),
          },
        },
      ],
    },
  },
];
