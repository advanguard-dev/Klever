import { GhostButton, MonoLabel, Overlay, Panel, SolidButton, TextButton } from "@/components/ui";
import {
  blobUrl,
  cropToBlob,
  extFromName,
  originalPath,
  resolveAssetSrc,
} from "@/lib/assets";
import { nid } from "@/lib/ids";
import { useApp } from "@/store";
import { useEffect, useRef, useState } from "react";

export function ImageBlock({
  src,
  caption,
  width,
  onWidth,
  onCaption,
  onReplaceSrc,
  readOnly,
}: {
  src: string;
  caption: string;
  width?: number;
  onWidth?: (width: number) => void;
  onCaption?: (caption: string) => void;
  /** Point markdown at a derived crop so the original file stays untouched. */
  onReplaceSrc?: (next: string) => void;
  /** Hide crop / resize chrome (Read mode). */
  readOnly?: boolean;
}) {
  const blobs = useApp((s) => s.blobs);
  const putBlob = useApp((s) => s.putBlob);
  const ensureBlob = useApp((s) => s.ensureBlob);
  const url = resolveAssetSrc(src, blobs);
  const hasData = Boolean(blobs[src.replace(/^\.\//, "")]?.data?.byteLength ?? blobs[src]?.data?.byteLength);
  const [zoom, setZoom] = useState(false);
  const [crop, setCrop] = useState(false);
  const [fit, setFit] = useState<"contain" | "actual">("contain");
  const dragging = useRef<{ startX: number; startW: number } | null>(null);
  const editable = !readOnly;

  useEffect(() => {
    if (!src || hasData) return;
    void ensureBlob(src.replace(/^\.\//, ""));
  }, [src, hasData, ensureBlob]);

  const w = width ?? 640;

  const onPointer = (e: React.PointerEvent) => {
    if (!onWidth) return;
    dragging.current = { startX: e.clientX, startW: w };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current || !onWidth) return;
    const next = Math.max(120, Math.min(960, dragging.current.startW + (e.clientX - dragging.current.startX)));
    onWidth(next);
  };
  const onUp = () => {
    dragging.current = null;
  };

  return (
    <>
      <figure className="relative my-6" style={{ maxWidth: w }}>
        <button type="button" className="block w-full" onClick={() => setZoom(true)}>
          <img src={url} alt={caption} className="block w-full" style={{ maxWidth: w }} />
        </button>
        {caption && (
          <figcaption className="mt-2 font-mono text-[11px] text-mute">
            {editable && onCaption ? (
              <input
                value={caption}
                onChange={(e) => onCaption(e.target.value)}
                className="klever-focus w-full rounded-md bg-transparent"
                aria-label="Image caption"
              />
            ) : (
              caption
            )}
          </figcaption>
        )}
        {editable && (
          <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-mute">
            <TextButton onClick={() => setCrop(true)}>Crop</TextButton>
            <span>{Math.round(w)}px</span>
          </div>
        )}
        {editable && onWidth && (
          <div
            className="absolute top-0 right-0 h-full w-3 cursor-ew-resize"
            onPointerDown={onPointer}
            onPointerMove={onMove}
            onPointerUp={onUp}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize image"
          />
        )}
      </figure>
      {zoom && (
        <Overlay onClose={() => setZoom(false)} title="Image">
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <MonoLabel>Zoom</MonoLabel>
              <div className="flex gap-3">
                <TextButton onClick={() => setFit("contain")}>Fit</TextButton>
                <TextButton onClick={() => setFit("actual")}>100%</TextButton>
                <TextButton onClick={() => setZoom(false)}>Close</TextButton>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <img
                src={url}
                alt={caption}
                className={fit === "contain" ? "max-h-[70vh] w-full object-contain" : "max-w-none"}
                draggable={false}
              />
            </div>
          </Panel>
        </Overlay>
      )}
      {editable && crop && (
        <CropModal
          src={src}
          url={url}
          onClose={() => setCrop(false)}
          onApply={async (blob) => {
            const rec = useApp.getState().blobs[src];
            const linked = Boolean(rec?.external || rec?.handle);
            if (linked) {
              const dest = `assets/${nid()}.${extFromName(src, blob.type)}`;
              await putBlob(blob, dest, blob.type);
              onReplaceSrc?.(dest);
            } else {
              if (rec && !useApp.getState().blobs[originalPath(src)]) {
                await putBlob(new Blob([rec.data], { type: rec.mime }), originalPath(src), rec.mime);
              }
              await putBlob(blob, src, blob.type);
            }
            setCrop(false);
          }}
        />
      )}
    </>
  );
}

function CropModal({
  src,
  url,
  onClose,
  onApply,
}: {
  src: string;
  url: string;
  onClose: () => void;
  onApply: (blob: Blob) => Promise<void>;
}) {
  const blobs = useApp((s) => s.blobs);
  const orig = blobs[originalPath(src)] ?? blobs[src];
  const display = orig ? blobUrl(originalPath(src) in blobs ? originalPath(src) : src, orig) : url;
  const [rect, setRect] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: string; sx: number; sy: number; start: typeof rect } | null>(null);
  const [busy, setBusy] = useState(false);

  const pos = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  useEffect(() => {
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  return (
    <Overlay onClose={onClose} title="Crop">
      <Panel className="p-4">
        <MonoLabel>Crop</MonoLabel>
        <div
          ref={box}
          className="relative mt-4 max-h-[60vh] overflow-hidden"
          onPointerMove={(e) => {
            if (!drag.current) return;
            const p = pos(e);
            const d = drag.current;
            const dx = p.x - d.sx;
            const dy = p.y - d.sy;
            let next = { ...d.start };
            if (d.kind === "move") {
              next.x = clamp(d.start.x + dx, 0, 1 - d.start.w);
              next.y = clamp(d.start.y + dy, 0, 1 - d.start.h);
            } else {
              next.w = clamp(d.start.w + dx, 0.05, 1 - d.start.x);
              next.h = clamp(d.start.h + dy, 0.05, 1 - d.start.y);
            }
            setRect(next);
          }}
        >
          <img src={display} alt="" className="block max-h-[60vh] w-full object-contain" />
          <div
            className="absolute border border-ink/70 bg-ink/10"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
            onPointerDown={(e) => {
              const p = pos(e);
              drag.current = { kind: "move", sx: p.x, sy: p.y, start: rect };
            }}
          >
            <button
              type="button"
              aria-label="Resize crop"
              className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize bg-ink"
              onPointerDown={(e) => {
                e.stopPropagation();
                const p = pos(e);
                drag.current = { kind: "resize", sx: p.x, sy: p.y, start: rect };
              }}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <SolidButton
            disabled={busy || !orig}
            onClick={() => {
              if (!orig) return;
              setBusy(true);
              void cropToBlob(orig, rect)
                .then(onApply)
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Cropping…" : "Apply"}
          </SolidButton>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
        </div>
      </Panel>
    </Overlay>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}
