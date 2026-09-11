import { createImage } from "@/components/freeform/board-model";
import { extFromName, isImageAsset } from "@/lib/assets";
import type { FreeformObject } from "@/types";

/** Center on the drop point. Do not scale w/h/fontSize — zoom is camera-only. */
export function fitDrop(obj: FreeformObject, center = true) {
  if (!center) return obj;
  return { ...obj, x: obj.x - obj.w / 2, y: obj.y - obj.h / 2 };
}

export type BoardImageItem = { path: string; name: string };

export function buildImageObjects(
  world: { x: number; y: number },
  items: BoardImageItem[],
  zStart: number,
): FreeformObject[] {
  let z = zStart;
  return items.map((item, i) =>
    fitDrop(createImage(world.x + i * 28, world.y + i * 28, z++, item.path, item.name)),
  );
}

export async function resolveImageFiles(
  files: File[],
  storeFileFromDrop: (file: File) => Promise<string | null | undefined>,
): Promise<BoardImageItem[]> {
  const images = files.filter((f) => isImageAsset(f.name, f.type));
  const items: BoardImageItem[] = [];
  for (const file of images) {
    const path = await storeFileFromDrop(file);
    if (!path) continue;
    items.push({ path, name: file.name || path.split("/").pop() || "Image" });
  }
  return items;
}

export async function readClipboardImageFiles(): Promise<File[]> {
  const files: File[] = [];
  try {
    const clipItems = await navigator.clipboard.read();
    for (const item of clipItems) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      const ext = extFromName("paste", type);
      files.push(new File([blob], `paste.${ext}`, { type }));
    }
  } catch {
    /* clipboard-read blocked */
  }
  return files;
}
