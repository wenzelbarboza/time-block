"use client";

/**
 * DragPreviewContext — shared live-preview state for an in-progress drag.
 *
 * PlannerDndContext populates this during onDragMove with the projected new
 * start/end minutes and the target column. Each DroppableColumn reads it to
 * render a ghost shadow at the destination position with the new time label.
 */

import * as React from "react";

export interface DragPreview {
  /** The block being dragged. */
  blockId: string;
  /** "move" (both start+end shift) or "resize" (only end shifts). */
  action: "move" | "resize";
  /** Projected new start minutes (snapped, clamped). */
  startMinutes: number;
  /** Projected new end minutes (snapped, clamped). */
  endMinutes: number;
  /** The revision index the preview shadow should render in. */
  revisionIndex: number;
  /** The source block type (for color matching). */
  blockType: string;
}

const Ctx = React.createContext<DragPreview | null>(null);

export const DragPreviewProvider = Ctx.Provider;

/** Read the current drag preview, if any. */
export function useDragPreview(): DragPreview | null {
  return React.useContext(Ctx);
}
