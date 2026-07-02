"use client";

/**
 * DraggableBlock — a TimeBlockCard wrapped for DnD (Step 5).
 *
 * Two drag sources:
 *   - "move-${id}"   : the block body (moves start+end together)
 *   - "resize-${id}" : a bottom grab handle (moves end only)
 *
 * Duplication:
 *   - Ctrl/Cmd + drag (same column) duplicates the block at the dropped time.
 *   - Right-click → "Duplicate" creates a copy immediately below the original.
 *   - Cross-column drag always duplicates (Pivot workflow).
 *
 * While a block is being dragged, the original is hidden (opacity-0) so the
 * <DragOverlay> preview is the only visible copy.
 */

/* eslint-disable react-hooks/refs -- @dnd-kit's useDraggable returns an object
   that contains setNodeRef; the react-hooks/refs rule misflags reading
   .transform/.listeners/.attributes off that object as "accessing a ref during
   render". This is the documented, idiomatic dnd-kit API. */
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, Copy, Move, Pencil, Trash2 } from "lucide-react";

import type { TimeBlock } from "@/lib/planner-store";
import { TimeBlockCard } from "@/components/planner/time-block-card";
import { useBlockActions } from "@/components/planner/block-actions-context";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface DraggableBlockProps {
  block: TimeBlock;
  /** The revision index this block lives in (used to detect cross-column drops). */
  sourceRevisionIndex: number;
  /** True while THIS block is actively being dragged (hide original). */
  isDragging?: boolean;
  struckThrough?: boolean;
  onDelete?: (id: string) => void;
  /** Called when the block is clicked (not dragged) — opens the edit dialog. */
  onEdit?: (block: TimeBlock) => void;
  /** Called to duplicate the block (creates a copy below the original). */
  onDuplicate?: (block: TimeBlock) => void;
  /** Called to open the "duplicate to date" dialog for this block. */
  onDuplicateToDate?: (block: TimeBlock) => void;
  disabled?: boolean;
}

export function DraggableBlock({
  block,
  sourceRevisionIndex,
  isDragging,
  struckThrough,
  onDelete,
  onEdit,
  onDuplicate,
  onDuplicateToDate,
  disabled,
}: DraggableBlockProps) {
  const moveId = `move-${block.id}`;
  const resizeId = `resize-${block.id}`;

  // Read the duplicate action from context (provided by PlannerDndContext) so
  // the right-click menu can trigger it. Falls back to the onDuplicate prop.
  const actions = useBlockActions();
  const handleDuplicate = onDuplicate ?? ((b: TimeBlock) => actions?.duplicate(b));

  // Carry the source revision index in the draggable's data so onDragEnd can
  // compare it against the drop target's column id and decide whether to move
  // (same column) or duplicate (different column).
  const move = useDraggable({
    id: moveId,
    disabled,
    data: { sourceRevisionIndex, blockType: block.blockType },
  });
  const resize = useDraggable({ id: resizeId, disabled });

  // Pull values out of the draggable hooks before JSX so the linter doesn't
  // mistake the hook return objects for refs.
  const moveRef = move.setNodeRef;
  const moveListeners = move.listeners;
  const moveAttributes = move.attributes;
  const resizeRef = resize.setNodeRef;
  const resizeListeners = resize.listeners;
  const resizeAttributes = resize.attributes;

  // NOTE: We intentionally do NOT apply move.transform / resize.transform as a
  // CSS transform to the handle elements. Doing so creates a feedback loop:
  // the transform moves the element → dnd-kit re-measures its rect → the
  // transform is recomputed from the new position → the element moves again.
  // The <DragOverlay> already provides the floating visual preview, so the
  // original handles stay put (the card itself is hidden via opacity-0).

  return (
    <TimeBlockCard
      block={block}
      struckThrough={struckThrough}
      hidden={isDragging}
      onDelete={onDelete}
      disabled={disabled}
    >
      {/* Move handle: covers the block body. We attach listeners here so the
          whole card is draggable, but stop propagation on the delete button
          (handled inside TimeBlockCard). z-0 so resize handle (z-20) and
          delete button (z-20) sit above it. This is ALSO the context-menu
          trigger (right-click → Duplicate / Edit / Delete). */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={moveRef}
            {...moveListeners}
            {...moveAttributes}
            onClick={(e) => {
              // A click (no drag movement due to the distance:5 activation
              // constraint) opens the edit dialog. Stop propagation so the event
              // doesn't bubble up to the column's onClick (which would also open
              // the Add Block dialog).
              e.stopPropagation();
              if (!disabled && onEdit) onEdit(block);
            }}
            onPointerDown={(e) => {
              // Right-click (button 2) should not start a drag or reach the
              // column — stop it here so only the context menu opens.
              if (e.button === 2) e.stopPropagation();
            }}
            className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing group-hover:ring-1 group-hover:ring-inset group-hover:ring-black/10"
            data-dnd="move"
            aria-label={`Drag to move ${block.title}`}
          >
            {/* Move grip indicator — appears on hover, centered at the top so it
                doesn't overlap the title text. */}
            <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-1 py-0.5 text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
              <Move className="size-2.5" />
            </span>
          </div>
        </ContextMenuTrigger>
        {!disabled && (
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => handleDuplicate(block)}
              className="gap-2"
            >
              <Copy className="size-4" />
              Duplicate
              <span className="ml-auto text-xs text-muted-foreground">Ctrl+Drag</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onDuplicateToDate?.(block)}
              className="gap-2"
            >
              <CalendarClock className="size-4" />
              Duplicate to date…
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onEdit?.(block)}
              className="gap-2"
            >
              <Pencil className="size-4" />
              Edit
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDelete?.(block.id)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Resize handle: a visible grab bar at the bottom of the block. z-20 so
          it stays above this block's move handle AND adjacent blocks' move
          handles (which are z-0). The bar is always faintly visible and
          becomes prominent on hover. */}
      <div
        ref={resizeRef}
        {...resizeListeners}
        {...resizeAttributes}
        onClick={(e) => {
          // A pure click on the resize handle shouldn't open the Add Block
          // dialog (which the column's onClick would do). Just stop propagation.
          e.stopPropagation();
        }}
        className="absolute bottom-0 left-0 right-0 z-20 flex h-3.5 cursor-ns-resize items-center justify-center rounded-b-md bg-black/0 transition-colors hover:bg-black/15 group-hover:bg-black/10"
        data-dnd="resize"
        aria-label={`Drag to resize ${block.title}`}
      >
        {/* Two small dots = "drag to resize" affordance, always visible */}
        <span className="flex items-center gap-0.5">
          <span className="size-1 rounded-full bg-current opacity-30 group-hover:opacity-70" />
          <span className="size-1 rounded-full bg-current opacity-30 group-hover:opacity-70" />
        </span>
      </div>
    </TimeBlockCard>
  );
}

/** Extract the block id and action from a draggable id ("move-<id>" / "resize-<id>"). */
export function parseDragId(dragId: string): { id: string; action: "move" | "resize" } | null {
  if (dragId.startsWith("move-")) return { id: dragId.slice(5), action: "move" };
  if (dragId.startsWith("resize-")) return { id: dragId.slice(7), action: "resize" };
  return null;
}
