import type { FreeformObject } from "@/types";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Per-variant patch (id/type stay locked by merge). Avoids Partial<union> common-key collapse. */
export type FreeformPatch = Partial<DistributiveOmit<FreeformObject, "id" | "type">>;

/** Merge a patch onto a board object without erasing its discriminant `type`/`id`. */
export function mergeObjectPatch<T extends FreeformObject>(obj: T, patch: FreeformPatch): T {
  return { ...obj, ...patch, id: obj.id, type: obj.type };
}
