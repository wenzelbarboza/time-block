"use client";

/**
 * TimeBlockCard — visual representation of a single time block.
 *
 * Step 4 (read-only): pure presentation. Positioned absolutely by the parent
 * column using top = (startMinutes - 420) * 2 and height = (endMinutes - start) * 2.
 * Step 5 will wrap this content in useDraggable (move) + a resize handle.
 *
 * Block colors per spec:
 *   DEEP     -> bg-blue-100  border-blue-500
 *   SHALLOW  -> bg-gray-100  border-gray-400
 *   MEETING  -> bg-orange-100 border-orange-500
 */

import * as React from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatBlockRange,
  formatDuration,
  minutesToPixels,
} from "@/lib/timeUtils";
import { getBlockType } from "@/lib/block-types";
import type { TimeBlock } from "@/lib/planner-store";

interface TimeBlockCardProps {
  block: TimeBlock;
  /** When true (block end is after now, in an older revision), strike through. */
  struckThrough?: boolean;
  /** Hide the card body (used by DragOverlay parent in Step 5). */
  hidden?: boolean;
  /** Children rendered as drag handle overlays (Step 5). */
  children?: React.ReactNode;
  onDelete?: (id: string) => void;
  /** Disable interactions (shutdown). */
  disabled?: boolean;
}

export function TimeBlockCard({
  block,
  struckThrough,
  hidden,
  children,
  onDelete,
  disabled,
}: TimeBlockCardProps) {
  const top = minutesToPixels(block.startMinutes);
  const height = Math.max(
    16,
    (block.endMinutes - block.startMinutes) * 2
  );

  const typeDef = getBlockType(block.blockType);
  const isShort = height < 44;

  return (
    <div
      className={cn(
        "group absolute w-full rounded-md border-l-4 px-2 py-1 shadow-sm transition-shadow",
        typeDef.style,
        struckThrough && "opacity-40 line-through",
        hidden && "opacity-0"
      )}
      style={{ top, height }}
      role="article"
      aria-label={`${block.title} ${formatBlockRange(block.startMinutes, block.endMinutes)}`}
    >
      <div className="flex h-full flex-col gap-0.5 overflow-hidden">
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", typeDef.dot)} />
            <h4
              className={cn(
                "truncate text-xs font-semibold leading-tight",
                isShort && "leading-4"
              )}
            >
              {block.title}
            </h4>
          </div>
          {onDelete && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(block.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="relative z-20 size-5 shrink-0 rounded text-current/60 opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100"
              aria-label="Delete block"
            >
              <Trash2 className="mx-auto size-3" />
            </button>
          )}
        </div>
        {!isShort && (
          <p className="pl-2.5 text-[10px] font-medium tabular-nums opacity-70">
            {formatBlockRange(block.startMinutes, block.endMinutes)}
            <span className="ml-1 opacity-60">
              · {formatDuration(block.startMinutes, block.endMinutes)}
            </span>
          </p>
        )}
        {block.description && height >= 50 && (
          <p className="pointer-events-none line-clamp-2 whitespace-pre-wrap pl-2.5 text-[10px] leading-tight opacity-60">
            {block.description}
          </p>
        )}
      </div>

      {/* Drag/resize handles injected by Step 5 */}
      {children}
    </div>
  );
}
