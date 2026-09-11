import {
  ArrangeStudio,
  BoardHud,
  type BoardStudio,
  BoardToolRail,
  BoardViewHud,
  HudConnectBtn,
  InkStudio,
  PaintWell,
  ShapeStudio,
  StickyStudio,
  TypeStudio,
  TableStudio,
} from "@/components/freeform/board-chrome";
import type { AlignEdge } from "@/components/freeform/board-ops";
import {
  type InkTool,
  type StrokeSwatch,
  stickyContrastTextColor,
  TABLE_TEXT_SIZES,
} from "@/components/freeform/board-model";
import type { FreeformPatch } from "@/lib/freeform-patch";
import { a1Range, applyTableStyle, insertTableFn, tableActiveStyle, type TableRange } from "@/lib/table-sheet";
import type {
  FreeformObject,
  FreeformShapeKind,
  FreeformStickyColor,
  FreeformStrokeDash,
  FreeformTool,
} from "@/types";

type TypeObj = Extract<FreeformObject, { type: "sticky" | "text" | "mind" | "shape" }>;
type StickyObj = Extract<FreeformObject, { type: "sticky" }>;
type ShapeObj = Extract<FreeformObject, { type: "shape" }>;
type TableObj = Extract<FreeformObject, { type: "table" }>;

export function BoardFloatingChrome({
  tool,
  studio,
  onTool,
  onStudio,
  shapeKind,
  shapeFill,
  shapeStroke,
  shapeWidth,
  shapeDash,
  onShapeKind,
  onShapeFill,
  onShapeStroke,
  onShapeWidth,
  onShapeDash,
  placeShape,
  inkTool,
  strokeColor,
  activeWidth,
  strokeSwatches,
  onInkTool,
  onStrokeColor,
  onStrokeWidth,
  stickyColor,
  onStickyColor,
  selectedCount,
  selectedSticky,
  selectedShape,
  selectedTable,
  selectedAny,
  typeObj,
  typeSizes,
  typeColorKey,
  tableRange,
  connectFrom,
  onPatch,
  onEdit,
  onBringForward,
  onBringFront,
  onSendBackward,
  onSendBack,
  onAlign,
  onConnectToggle,
  onSetTool,
  zoomPct,
  minZoomPct,
  maxZoomPct,
  dotted,
  onZoomOut,
  onZoomReset,
  onZoomIn,
  onZoomPct,
  onDots,
}: {
  tool: FreeformTool;
  studio: BoardStudio;
  onTool: (id: FreeformTool) => void;
  onStudio: (s: BoardStudio) => void;
  shapeKind: FreeformShapeKind;
  shapeFill: string;
  shapeStroke: string;
  shapeWidth: number;
  shapeDash: FreeformStrokeDash;
  onShapeKind: (k: FreeformShapeKind) => void;
  onShapeFill: (id: string) => void;
  onShapeStroke: (id: string) => void;
  onShapeWidth: (n: number) => void;
  onShapeDash: (d: FreeformStrokeDash) => void;
  placeShape: (k: FreeformShapeKind) => void;
  inkTool: InkTool;
  strokeColor: string;
  activeWidth: number;
  strokeSwatches: StrokeSwatch[];
  onInkTool: (t: InkTool) => void;
  onStrokeColor: (c: string) => void;
  onStrokeWidth: (n: number) => void;
  stickyColor: FreeformStickyColor;
  onStickyColor: (id: FreeformStickyColor) => void;
  selectedCount: number;
  selectedSticky: StickyObj | null | undefined;
  selectedShape: ShapeObj | null | undefined;
  selectedTable: TableObj | null | undefined;
  selectedAny: FreeformObject | null;
  typeObj: TypeObj | null | undefined;
  typeSizes: readonly number[];
  typeColorKey: "textColor" | "color";
  tableRange: TableRange | null;
  connectFrom: string | null;
  onPatch: (id: string, patch: FreeformPatch) => void;
  onEdit: (id: string) => void;
  onBringForward: () => void;
  onBringFront: () => void;
  onSendBackward: () => void;
  onSendBack: () => void;
  onAlign: (edge: AlignEdge) => void;
  onConnectToggle: (id: string) => void;
  onSetTool: (t: FreeformTool) => void;
  zoomPct: number;
  minZoomPct: number;
  maxZoomPct: number;
  dotted: boolean;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
  onZoomPct: (pct: number) => void;
  onDots: () => void;
}) {
  const hud =
    selectedCount > 0 ? (
      <BoardHud
        studio={studio}
        onStudio={onStudio}
        paint={
          <PaintWell
            fill={selectedSticky?.color ?? selectedShape?.fill}
            stroke={selectedShape?.stroke ?? "ink"}
            fillOnly={Boolean(selectedSticky)}
            open={studio === "paint"}
            onToggle={() => onStudio(studio === "paint" ? null : "paint")}
          />
        }
        paintOpen={studio === "paint"}
        paintPanel={
          selectedSticky ? (
            <StickyStudio
              color={selectedSticky.color}
              onColor={(id) => {
                onStickyColor(id as FreeformStickyColor);
                onPatch(selectedSticky.id, {
                  color: id,
                  textColor: stickyContrastTextColor(id),
                });
              }}
            />
          ) : selectedShape ? (
            <ShapeStudio
              kind={selectedShape.shape}
              fill={selectedShape.fill}
              stroke={selectedShape.stroke}
              width={selectedShape.strokeWidth}
              dash={selectedShape.strokeDash}
              onKind={(k) => {
                onShapeKind(k);
                onPatch(selectedShape.id, { shape: k });
              }}
              onFill={(id) => {
                onShapeFill(id);
                onPatch(selectedShape.id, { fill: id });
              }}
              onStroke={(id) => {
                onShapeStroke(id);
                onPatch(selectedShape.id, { stroke: id });
              }}
              onWidth={(n) => {
                onShapeWidth(n);
                onPatch(selectedShape.id, { strokeWidth: n });
              }}
              onDash={(d) => {
                onShapeDash(d);
                onPatch(selectedShape.id, { strokeDash: d });
              }}
              showLabel={selectedShape.showLabel !== false}
              onShowLabel={(on) => {
                onPatch(selectedShape.id, { showLabel: on });
              }}
            />
          ) : null
        }
        hasPaint={Boolean(selectedSticky || selectedShape)}
        hasType={Boolean(typeObj || selectedTable)}
        typePanel={
          selectedTable ? (
            <TableStudio
              style={tableActiveStyle(selectedTable, tableRange)}
              sizes={TABLE_TEXT_SIZES}
              selection={tableRange ? a1Range(tableRange) : "A1"}
              onStyle={(patch) =>
                onPatch(selectedTable.id, applyTableStyle(selectedTable, tableRange, patch))
              }
              onFn={(fn) => {
                onPatch(selectedTable.id, insertTableFn(selectedTable, tableRange, fn));
                onEdit(selectedTable.id);
              }}
            />
          ) : typeObj ? (
            <TypeStudio
              obj={typeObj}
              sizes={typeSizes}
              colorKey={typeColorKey}
              onPatch={onPatch}
              onEdit={onEdit}
            />
          ) : null
        }
        arrangePanel={
          <ArrangeStudio
            multi={selectedCount > 1}
            onForward={onBringForward}
            onFront={onBringFront}
            onBackward={onSendBackward}
            onBack={onSendBack}
            onAlign={onAlign}
          />
        }
        connect={
          selectedAny ? (
            <HudConnectBtn
              active={connectFrom === selectedAny.id}
              onClick={() => {
                onSetTool("select");
                onConnectToggle(selectedAny.id);
              }}
            />
          ) : null
        }
      />
    ) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 md:bottom-auto md:left-3 md:top-1/2 md:translate-x-0 md:-translate-y-1/2">
        <BoardToolRail
          tool={tool}
          studio={studio}
          onTool={onTool}
          onStudio={onStudio}
          shape={
            <ShapeStudio
              kind={shapeKind}
              fill={shapeFill}
              stroke={shapeStroke}
              width={shapeWidth}
              dash={shapeDash}
              onKind={(k) => {
                onShapeKind(k);
                placeShape(k);
              }}
              onFill={onShapeFill}
              onStroke={onShapeStroke}
              onWidth={onShapeWidth}
              onDash={onShapeDash}
            />
          }
          ink={
            <InkStudio
              tool={inkTool}
              color={strokeColor}
              width={activeWidth}
              swatches={strokeSwatches}
              minW={inkTool === "highlighter" ? 8 : 1}
              maxW={inkTool === "highlighter" ? 32 : 6}
              onTool={onInkTool}
              onColor={onStrokeColor}
              onWidth={onStrokeWidth}
            />
          }
          sticky={
            <StickyStudio color={stickyColor} onColor={(id) => onStickyColor(id as FreeformStickyColor)} />
          }
        />
      </div>
      {hud && (
        <div className="absolute bottom-[4.75rem] left-1/2 z-20 -translate-x-1/2 md:bottom-4">
          {hud}
        </div>
      )}
      <div className="absolute right-3 top-3 z-20 md:bottom-4 md:right-4 md:top-auto">
        <BoardViewHud
          zoomPct={zoomPct}
          minPct={minZoomPct}
          maxPct={maxZoomPct}
          dotted={dotted}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
          onZoomIn={onZoomIn}
          onZoomPct={onZoomPct}
          onDots={onDots}
        />
      </div>
    </div>
  );
}
