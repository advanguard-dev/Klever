import type { Note } from "@/types";
import { resolveLink } from "@/lib/parse";

export const RELATION_KINDS = [
  { key: "related", label: "Related", hint: "General connection", directed: false },
  { key: "references", label: "References", hint: "This page cites the other", directed: true },
  { key: "supports", label: "Supports", hint: "This page backs the other", directed: true },
  { key: "dependsOn", label: "Depends on", hint: "This page needs the other", directed: true },
  { key: "inspiredBy", label: "Inspired by", hint: "Creative or conceptual source", directed: true },
  { key: "partOf", label: "Part of", hint: "This page belongs to the other", directed: true },
] as const;

export type RelationKindKey = (typeof RELATION_KINDS)[number]["key"];

const RELATION_KEY_SET = new Set<string>(RELATION_KINDS.map((k) => k.key));

/** Also treat these inverse / schema keys as relations in the graph. */
const EXTRA_RELATION_KEYS = new Set(["people", "includes", "referencedBy", "inspires"]);

export function isRelationPropKey(key: string, schemaType?: string) {
  if (schemaType === "relation" || schemaType === "people") return true;
  return RELATION_KEY_SET.has(key) || EXTRA_RELATION_KEYS.has(key);
}

/** Page-to-page links only — skip people/contact fields from check/remove lists. */
function isListedRelationKey(key: string, schemaType?: string) {
  if (schemaType === "people") return false;
  if (schemaType === "relation") return true;
  if (key === "people") return false;
  return RELATION_KEY_SET.has(key) || EXTRA_RELATION_KEYS.has(key);
}

export function relationKindLabel(key: string): string {
  return RELATION_KINDS.find((k) => k.key === key)?.label ?? key;
}

export function asRelationList(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  if (val == null || val === "") return [];
  return [String(val).trim()].filter(Boolean);
}

/** Inverse prop key when linking both ways for directed kinds. */
export function inverseRelationKey(key: RelationKindKey): string {
  switch (key) {
    case "references":
      return "referencedBy";
    case "supports":
      return "dependsOn";
    case "dependsOn":
      return "supports";
    case "inspiredBy":
      return "inspires";
    case "partOf":
      return "includes";
    default:
      return "related";
  }
}

export function addRelationToProps(
  props: Record<string, unknown>,
  kind: string,
  targetRef: string,
): Record<string, unknown> {
  const list = asRelationList(props[kind]);
  if (list.some((x) => x.toLowerCase() === targetRef.toLowerCase())) {
    return props;
  }
  return { ...props, [kind]: [...list, targetRef] };
}

export function removeRelationFromProps(
  props: Record<string, unknown>,
  kind: string,
  targetRef: string,
): Record<string, unknown> {
  const list = asRelationList(props[kind]).filter(
    (x) => x.toLowerCase() !== targetRef.toLowerCase(),
  );
  const next = { ...props };
  if (list.length) next[kind] = list;
  else delete next[kind];
  return next;
}

function propSchemaType(note: Note, notes: Note[], key: string) {
  return (
    notes.find((n) => n.id === note.parent)?.schema?.find((s) => s.key === key)?.type ??
    note.schema?.find((s) => s.key === key)?.type
  );
}

export type ListedRelation = {
  id: string;
  storeId: string;
  key: string;
  label: string;
  ref: string;
  peer?: Note;
  incoming: boolean;
};

export function listNoteRelations(note: Note, notes: Note[]): ListedRelation[] {
  const out: ListedRelation[] = [];
  const seen = new Set<string>();
  const push = (rel: ListedRelation) => {
    if (seen.has(rel.id)) return;
    seen.add(rel.id);
    out.push(rel);
  };

  for (const [key, val] of Object.entries(note.props ?? {})) {
    if (!isListedRelationKey(key, propSchemaType(note, notes, key))) continue;
    for (const ref of asRelationList(val)) {
      push({
        id: `${note.id}:${key}:${ref}`,
        storeId: note.id,
        key,
        label: relationKindLabel(key),
        ref,
        peer: resolveLink(ref, notes),
        incoming: false,
      });
    }
  }

  for (const other of notes) {
    if (other.id === note.id) continue;
    for (const [key, val] of Object.entries(other.props ?? {})) {
      if (!isListedRelationKey(key, propSchemaType(other, notes, key))) continue;
      for (const ref of asRelationList(val)) {
        const hit = resolveLink(ref, notes);
        if (hit?.id !== note.id && ref !== note.title && ref !== note.path && ref !== note.id) continue;
        push({
          id: `${other.id}:${key}:${ref}`,
          storeId: other.id,
          key,
          label: relationKindLabel(key),
          ref,
          peer: other,
          incoming: true,
        });
      }
    }
  }

  return out.sort(
    (a, b) =>
      Number(a.incoming) - Number(b.incoming) ||
      a.label.localeCompare(b.label) ||
      (a.peer?.title ?? a.ref).localeCompare(b.peer?.title ?? b.ref),
  );
}

function stripRefFromKey(props: Record<string, unknown>, key: string, note: Note) {
  let next = removeRelationFromProps(props, key, note.title);
  next = removeRelationFromProps(next, key, note.id);
  next = removeRelationFromProps(next, key, note.path);
  return next;
}

export function unlinkNoteRelation(
  rel: ListedRelation,
  notes: Note[],
  selfId: string,
): { id: string; props: Record<string, unknown> }[] {
  const store = notes.find((n) => n.id === rel.storeId);
  if (!store) return [];
  const patches: { id: string; props: Record<string, unknown> }[] = [
    { id: store.id, props: removeRelationFromProps(store.props, rel.key, rel.ref) },
  ];
  const reverse = rel.incoming
    ? notes.find((n) => n.id === selfId)
    : rel.peer;
  if (!reverse || reverse.id === store.id) return patches;
  const backKeys = new Set<string>([rel.key]);
  if (RELATION_KEY_SET.has(rel.key)) {
    backKeys.add(inverseRelationKey(rel.key as RelationKindKey));
  } else if (rel.key === "referencedBy") backKeys.add("references");
  else if (rel.key === "includes") backKeys.add("partOf");
  else if (rel.key === "inspires") backKeys.add("inspiredBy");
  let props = reverse.props;
  for (const key of backKeys) props = stripRefFromKey(props, key, store);
  patches.push({ id: reverse.id, props });
  return patches;
}
