"use client";

/**
 * GridColumn — one revision column of the pivot grid.
 *
 * Step 4 (read-only): a relative div that renders its blocks absolutely and
 * handles click-to-add (computing the clicked minute via clientY math).
 * Step 5 will convert this into a useDroppable area inside <DndContext>.
 *
 * Block positioning math:
 *   top    = (startMinutes - 420) * 2
 *   height = (endMinutes - startMinutes) * 2
 */

import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
} from "@/lib/timeUtils";
import type { TimeBlock } from "@/lib/planner-store";
import { TimeBlockCard } from "@/components/planner/time-block-card";

interface GridColumnProps {
  /** This column's revision index (0 = original plan). */
  revisionIndex: number;
  /** The current (highest) revision index — columns after this are "future". */
  currentRevisionIndex: number;
  /** Blocks belonging to this revision. */
  blocks: TimeBlock[];
  /** Current time in minutes (user TZ), or null before client mount. */
  now?: number | null;
  /** Whether shutdown is complete (disables interactions). */
  disabled?: boolean;
  /** Called with the clicked minute when the user clicks empty space. */
  onAddBlock?: (revisionIndex: number, startMinutes: number) => void;
  /** Delete handler. */
  onDeleteBlock?: (id: string) => void;
}

export function GridColumn({
  revisionIndex,
  currentRevisionIndex,
  blocks,
  now,
  disabled,
  onAddBlock,
  onDeleteBlock,
}: GridColumnProps) {
  const nowMin = now ?? 0;
  const isPastRevision = revisionIndex < currentRevisionIndex;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onAddBlock) return;
    // CRITICAL MATH: clicked minute from clientY.
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor(y / 2) + GRID_START_MINUTES;
    if (minutes < GRID_START_MINUTES || minutes > GRID_END_MINUTES) return;
    onAddBlock(revisionIndex, minutes);
  };

  return (
    <div
      data-revision={revisionIndex}
      className={cn(
        "relative h-full flex-1 border-r border-gray-200 last:border-r-0",
        "bg-background/40 transition-colors",
        !disabled && "cursor-crosshair hover:bg-accent/30"
      )}
      onClick={handleClick}
      role="presentation"
    >
      {/* Hour gridlines for visual rhythm */}
      {Array.from({ length: 12 }, (_, i) => (i + 1) * 120).map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-border/40"
          style={{ top }}
        />
      ))}

      {/* Blocks */}
      {blocks.map((block) => {
        // Only strike through once "now" is known (client) — avoids SSR
        // mismatch and uses the user's timezone.
        const struck = now !== null && isPastRevision && block.endMinutes > nowMin;
        return (
          <TimeBlockCard
            key={block.id}
            block={block}
            struckThrough={struck}
            onDelete={onDeleteBlock}
            disabled={disabled}
          />
        );
      })}

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
