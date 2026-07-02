"use client";

/**
 * DroppableColumn — a GridColumn that is also a DnD drop target.
 *
 * Each column registers as a useDroppable area so @dnd-kit can track which
 * column a block is over. The column id encodes the revision index so
 * onDragEnd can update the block's revisionIndex if it was moved across.
 */

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  formatBlockRange,
  formatDuration,
  minutesToPixels,
} from "@/lib/timeUtils";
import type { TimeBlock } from "@/lib/planner-store";
import { usePlannerStore } from "@/lib/planner-store";
import { DraggableBlock } from "@/components/planner/draggable-block";
import { useDragPreview } from "@/components/planner/drag-preview-context";

interface DroppableColumnProps {
  revisionIndex: number;
  currentRevisionIndex: number;
  blocks: TimeBlock[];
  /** The id of the block currently being dragged (to hide its original). */
  draggingBlockId?: string | null;
  now?: number | null;
  disabled?: boolean;
  onAddBlock?: (revisionIndex: number, startMinutes: number) => void;
  onDeleteBlock?: (id: string) => void;
  onEditBlock?: (block: TimeBlock) => void;
  onDuplicateToDate?: (block: TimeBlock) => void;
}

export function DroppableColumn({
  revisionIndex,
  currentRevisionIndex,
  blocks,
  draggingBlockId,
  now,
  disabled,
  onAddBlock,
  onDeleteBlock,
  onEditBlock,
  onDuplicateToDate,
}: DroppableColumnProps) {
  const droppableId = `column-${revisionIndex}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const nowMin = now ?? 0;
  // Read merged (server + optimistic) block state so drags visually reposition.
  const getBlock = usePlannerStore((s) => s.getBlock);
  // Live drag preview — render a ghost shadow when it targets THIS column.
  const preview = useDragPreview();
  const showPreview = preview !== null && preview.revisionIndex === revisionIndex;

  // Track right-clicks so the subsequent click (fired after the context menu
  // closes) is ignored by the column's add-block handler.
  const rightClickAt = React.useRef(0);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onAddBlock) return;
    // Ignore clicks that follow a right-click (the context menu close
    // sequence) — they shouldn't open the Add Block dialog.
    if (Date.now() - rightClickAt.current < 2000) return;
    // Only treat as "add block" if the click landed on the column itself (or
    // its gridlines), NOT on a block or any interactive child. This prevents
    // clicks that bubble up from blocks (after a context-menu action, etc.)
    // from opening the Add Block dialog.
    const target = e.target as HTMLElement;
    if (target.closest("[role=article]") || target.closest("[data-dnd]")) {
      return;
    }
    // CRITICAL MATH: clicked minute from clientY.
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor(y / 2) + GRID_START_MINUTES;
    if (minutes < GRID_START_MINUTES || minutes > GRID_END_MINUTES) return;
    onAddBlock(revisionIndex, minutes);
  };

  return (
    <div
      ref={setNodeRef}
      data-revision={revisionIndex}
      data-droppable={isOver ? "true" : "false"}
      className={cn(
        "relative h-full flex-1 border-r border-gray-200 last:border-r-0",
        "bg-background/40 transition-colors",
        isOver && "bg-accent/40 ring-1 ring-inset ring-primary/30",
        !disabled && "cursor-crosshair hover:bg-accent/30"
      )}
      onClick={handleClick}
      onContextMenu={() => {
        // Record the time of a right-click so the column's click handler can
        // ignore the click that fires when the context menu closes.
        rightClickAt.current = Date.now();
      }}
      role="presentation"
    >
      {/* Hour gridlines for visual rhythm (24 hours) */}
      {Array.from({ length: 24 }, (_, i) => (i + 1) * 120).map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-border/40"
          style={{ top }}
        />
      ))}

      {/* Blocks */}
      {blocks.map((rawBlock) => {
        // Merge optimistic overlay so the block visually moves/resizes instantly.
        const block = getBlock(rawBlock.id) ?? rawBlock;
        // Strike through COMPLETED blocks (whose end time has passed), not
        // upcoming ones. Applies across all revisions so you can see at a
        // glance which scheduled blocks are already done.
        const struck = now !== null && block.endMinutes <= nowMin;
        return (
          <DraggableBlock
            key={block.id}
            block={block}
            sourceRevisionIndex={revisionIndex}
            struckThrough={struck}
            isDragging={draggingBlockId === block.id}
            onDelete={onDeleteBlock}
            onEdit={onEditBlock}
            onDuplicateToDate={onDuplicateToDate}
            disabled={disabled}
          />
        );
      })}

      {/* Live drag-preview ghost shadow at the projected destination */}
      {showPreview && preview && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-30 rounded-md border-2 border-dashed border-primary/60 bg-primary/10"
          style={{
            top: minutesToPixels(preview.startMinutes),
            height: Math.max(16, (preview.endMinutes - preview.startMinutes) * 2),
          }}
          aria-hidden="true"
        >
          <div className="flex h-full flex-col justify-center px-2">
            <span className="truncate text-[10px] font-bold tabular-nums text-primary">
              {formatBlockRange(preview.startMinutes, preview.endMinutes)}
            </span>
            <span className="text-[9px] font-medium tabular-nums text-primary/70">
              {formatDuration(preview.startMinutes, preview.endMinutes)}
              {preview.action === "resize" ? " · resize" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Empty-state hint for the newest column */}
      {blocks.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground/60">
            <Plus className="size-5" />
            <span>Click to add a block</span>
          </div>
        </div>
      )}
    </div>
  );
}
