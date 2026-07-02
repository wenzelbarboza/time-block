"use client";

/**
 * BlockActionsContext — exposes block-level actions (like duplicate) from the
 * PlannerDndContext down to the DraggableBlock, so the right-click context
 * menu can trigger them without prop-drilling through every column.
 */

import * as React from "react";
import type { TimeBlock } from "@/lib/planner-store";

export interface BlockActions {
  /** Duplicate a block. With no explicit times, copies it just below the original. */
  duplicate: (block: TimeBlock, startMinutes?: number, endMinutes?: number, revisionIndex?: number) => void;
  /** Duplicate a block to a different date's plan. Returns the target date string on success. */
  duplicateToDate: (block: TimeBlock, dateStr: string) => Promise<string | null>;
}

const Ctx = React.createContext<BlockActions | null>(null);

export const BlockActionsProvider = Ctx.Provider;

/** Read the block actions (duplicate, etc.) if available. */
export function useBlockActions(): BlockActions | null {
  return React.useContext(Ctx);
}
