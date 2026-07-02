"use client";

/**
 * PlannerDndContext — wraps the pivot grid with full DnD (Step 5).
 *
 * - MouseSensor + TouchSensor with activationConstraint { distance: 5 } so a
 *   drag release never fires the column's onClick (add-block modal).
 * - Modifiers: restrictToVerticalAxis + createSnapModifier(30) for 15-min snap.
 *   (restrictToParentElement was removed — see comment at the modifiers array.)
 * - DragOverlay renders a floating preview; the original block is hidden.
 * - onDragEnd math: deltaMinutes = Math.round(delta.y / 2). Move adds it to
 *   both start+end; resize adds it to end only. State updates go through
 *   Zustand for instant feedback, then the API persists.
 */

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  createSnapModifier,
} from "@dnd-kit/modifiers";

import type { DayPlan, TimeBlock } from "@/lib/planner-store";
import { usePlannerStore } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  snapTo15,
} from "@/lib/timeUtils";
import { getBlockType } from "@/lib/block-types";
import { parseDragId } from "@/components/planner/draggable-block";
import {
  DragPreviewProvider,
  type DragPreview,
} from "@/components/planner/drag-preview-context";
import {
  BlockActionsProvider,
} from "@/components/planner/block-actions-context";

interface PlannerDndContextProps {
  children: React.ReactNode;
  dayPlan: DayPlan;
  disabled?: boolean;
}

export function PlannerDndContext({ children, dayPlan, disabled }: PlannerDndContextProps) {
  const { toast } = useToast();
  const storeDayPlan = usePlannerStore((s) => s.activeDayPlan);

  // Track whether Ctrl/Cmd is held so a same-column drag duplicates instead of
  // moving (the Figma/Photoshop convention).
  const duplicateHeld = React.useRef(false);
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) duplicateHeld.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) duplicateHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", () => (duplicateHeld.current = false));
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const activeDayPlan = storeDayPlan ?? dayPlan;
  const updateOptimisticBlock = usePlannerStore((s) => s.updateOptimisticBlock);
  const clearOptimisticBlock = usePlannerStore((s) => s.clearOptimisticBlock);
  const getBlock = usePlannerStore((s) => s.getBlock);
  const addBlock = usePlannerStore((s) => s.addBlock);

  // Active drag tracking for the DragOverlay preview.
  const [activeDrag, setActiveDrag] = React.useState<{
    blockId: string;
    action: "move" | "resize";
  } | null>(null);

  // Live drag preview: the projected new start/end + target column, updated on
  // every dragMove so columns can render a ghost shadow at the destination.
  const [preview, setPreview] = React.useState<DragPreview | null>(null);

  // Sensors: require 5px of movement before a drag starts. This is the
  // critical bug-prevention so a click (to add a block) isn't hijacked.
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { distance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Modifiers: vertical-only + snap to 30px (15-min increments).
  // The onDragEnd handler clamps to the grid range (7AM–7PM).
  const snapModifier = React.useMemo(() => createSnapModifier(30), []);
  const modifiers = React.useMemo(
    () => [restrictToVerticalAxis, snapModifier],
    [snapModifier]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = parseDragId(String(event.active.id));
    if (parsed) setActiveDrag({ blockId: parsed.id, action: parsed.action });
  };

  // Compute the projected new start/end from a drag delta (shared by move +
  // resize). Snaps to 15 min and clamps to the grid range.
  const computeProjected = (
    block: TimeBlock,
    action: "move" | "resize",
    deltaMinutes: number,
    targetRevisionIndex: number
  ): DragPreview => {
    if (action === "move") {
      const newStart = snapTo15(
        Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, block.startMinutes + deltaMinutes))
      );
      const duration = block.endMinutes - block.startMinutes;
      let newEnd = newStart + duration;
      if (newEnd > GRID_END_MINUTES) newEnd = GRID_END_MINUTES;
      return {
        blockId: block.id,
        action,
        startMinutes: newStart,
        endMinutes: newEnd,
        revisionIndex: targetRevisionIndex,
        blockType: block.blockType,
      };
    }
    // resize: only end moves, min 15-min duration.
    const rawEnd = block.endMinutes + deltaMinutes;
    const newEnd = snapTo15(
      Math.max(block.startMinutes + 15, Math.min(GRID_END_MINUTES, rawEnd))
    );
    return {
      blockId: block.id,
      action,
      startMinutes: block.startMinutes,
      endMinutes: newEnd,
      revisionIndex: targetRevisionIndex,
      blockType: block.blockType,
    };
  };

  // Update the live preview shadow on every mouse move during a drag.
  const handleDragMove = (event: DragMoveEvent) => {
    const parsed = parseDragId(String(event.active.id));
    if (!parsed) return;
    const block = getBlock(parsed.id);
    if (!block) return;
    const deltaMinutes = Math.round(event.delta.y / 2);
    const sourceRevisionIndex =
      (event.active.data.current as { sourceRevisionIndex?: number } | undefined)?.sourceRevisionIndex
        ?? block.revisionIndex;
    const overId = event.over?.id ? String(event.over.id) : null;
    const targetRevisionIndex = overId?.startsWith("column-")
      ? Number(overId.slice("column-".length))
      : sourceRevisionIndex;
    const next = computeProjected(block, parsed.action, deltaMinutes, targetRevisionIndex);
    setPreview(next);
  };

  /**
   * Duplicate a block — creates a copy with a new id. Used by both the
   * Ctrl/Cmd+drag flow (at the dropped time) and the right-click context menu
   * (immediately below the original).
   */
  const duplicateBlock = React.useCallback(
    async (block: TimeBlock, startMinutes?: number, endMinutes?: number, revisionIndex?: number) => {
      const duration = block.endMinutes - block.startMinutes;
      const newStart =
        startMinutes !== undefined
          ? snapTo15(Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, startMinutes)))
          : snapTo15(Math.min(GRID_END_MINUTES, block.endMinutes + 15));
      let newEnd = endMinutes !== undefined ? endMinutes : newStart + duration;
      if (newEnd > GRID_END_MINUTES) newEnd = GRID_END_MINUTES;
      const rev = revisionIndex ?? block.revisionIndex;

      const tempId = `temp-${Date.now()}`;
      const optimistic: TimeBlock = {
        id: tempId,
        dayPlanId: block.dayPlanId,
        title: block.title,
        description: block.description,
        blockType: block.blockType,
        startMinutes: newStart,
        endMinutes: newEnd,
        revisionIndex: rev,
      };
      addBlock(optimistic);
      try {
        const created = await api.createBlock({
          dayPlanId: block.dayPlanId,
          title: block.title,
          description: block.description,
          blockType: block.blockType,
          startMinutes: newStart,
          endMinutes: newEnd,
          revisionIndex: rev,
        });
        usePlannerStore.setState((s) => ({
          activeDayPlan: s.activeDayPlan
            ? {
                ...s.activeDayPlan,
                timeBlocks: s.activeDayPlan.timeBlocks.map((b) =>
                  b.id === tempId ? created : b
                ),
              }
            : s.activeDayPlan,
        }));
        toast({ title: "Block duplicated", description: block.title });
      } catch {
        usePlannerStore.setState((s) => ({
          activeDayPlan: s.activeDayPlan
            ? {
                ...s.activeDayPlan,
                timeBlocks: s.activeDayPlan.timeBlocks.filter((b) => b.id !== tempId),
              }
            : s.activeDayPlan,
        }));
        toast({ title: "Duplicate failed", variant: "destructive" });
      }
    },
    [addBlock, toast]
  );

  /**
   * Duplicate a block to a DIFFERENT date's plan. Fetches (or creates) the
   * target day's plan, then creates a copy of the block there with the same
   * time, type, title, and description. The block does NOT appear in the
   * current view (it's in another day). Returns the target date string on
   * success, or null on failure.
   */
  const duplicateToDate = React.useCallback(
    async (block: TimeBlock, dateStr: string): Promise<string | null> => {
      try {
        const targetPlan = await api.fetchDayPlan(dateStr);
        await api.createBlock({
          dayPlanId: targetPlan.id,
          title: block.title,
          description: block.description,
          blockType: block.blockType,
          startMinutes: block.startMinutes,
          endMinutes: block.endMinutes,
          revisionIndex: 0,
        });
        toast({
          title: "Copied to " + dateStr,
          description: `${block.title} duplicated to the target date.`,
        });
        return dateStr;
      } catch {
        toast({ title: "Couldn't copy to that date", variant: "destructive" });
        return null;
      }
    },
    [toast]
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const parsed = parseDragId(String(event.active.id));
    setActiveDrag(null);
    setPreview(null);
    if (!parsed) return;

    const block = getBlock(parsed.id);
    if (!block) return;

    // CRITICAL MATH: 1 minute = 2px, so delta.y / 2 = minutes moved.
    const deltaMinutes = Math.round(event.delta.y / 2);

    if (parsed.action === "move") {
      // Detect cross-column drop: if the block was dropped into a different
      // revision column, DUPLICATE it there (keeping the original) instead of
      // moving it. This supports the Pivot workflow — reuse tasks from an
      // earlier revision at new times in the new column.
      const sourceRevisionIndex =
        (event.active.data.current as { sourceRevisionIndex?: number } | undefined)?.sourceRevisionIndex
          ?? block.revisionIndex;
      const overId = event.over?.id ? String(event.over.id) : null;
      const targetRevisionIndex = overId?.startsWith("column-")
        ? Number(overId.slice("column-".length))
        : null;

      const isCrossColumn =
        targetRevisionIndex !== null && targetRevisionIndex !== sourceRevisionIndex;

      // Compute the new start/end (clamped to the grid, snapped to 15 min).
      const newStart = snapTo15(
        Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, block.startMinutes + deltaMinutes))
      );
      const duration = block.endMinutes - block.startMinutes;
      let newEnd = newStart + duration;
      if (newEnd > GRID_END_MINUTES) {
        newEnd = GRID_END_MINUTES;
      }

      if (isCrossColumn && targetRevisionIndex !== null) {
        // Cross-column drop → DUPLICATE into the target column (Pivot workflow).
        await duplicateBlock(block, newStart, newEnd, targetRevisionIndex);
        return;
      }

      // Same-column: if Ctrl/Cmd was held, DUPLICATE at the dropped time
      // instead of moving the original.
      if (duplicateHeld.current) {
        await duplicateBlock(block, newStart, newEnd, sourceRevisionIndex);
        return;
      }

      // Same-column MOVE (original behavior): update start+end in place.
      updateOptimisticBlock(block.id, {
        startMinutes: newStart,
        endMinutes: newEnd,
      });
      try {
        await api.updateBlock(block.id, { startMinutes: newStart, endMinutes: newEnd });
      } catch {
        clearOptimisticBlock(block.id);
        toast({ title: "Move failed", variant: "destructive" });
      }
    } else {
      // Resize: only end moves. Enforce a 15-min minimum duration.
      const rawEnd = block.endMinutes + deltaMinutes;
      const newEnd = snapTo15(
        Math.max(block.startMinutes + 15, Math.min(GRID_END_MINUTES, rawEnd))
      );
      if (newEnd === block.endMinutes) {
        clearOptimisticBlock(block.id);
        return;
      }
      updateOptimisticBlock(block.id, { endMinutes: newEnd });
      try {
        await api.updateBlock(block.id, { endMinutes: newEnd });
      } catch {
        clearOptimisticBlock(block.id);
        toast({ title: "Resize failed", variant: "destructive" });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
    setPreview(null);
  };

  // Resolve the active block for the overlay preview (use the merged
  // server+optimistic view so the overlay reflects the live state).
  const activeBlock = activeDrag
    ? getBlock(activeDrag.blockId) ?? null
    : null;

  return (
    <DragPreviewProvider value={preview}>
      <BlockActionsProvider value={{ duplicate: duplicateBlock, duplicateToDate }}>
        <DndContext
          sensors={sensors}
          modifiers={modifiers}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {children}
          <DragOverlay dropAnimation={null}>
            {activeBlock ? <BlockOverlay block={activeBlock} /> : null}
          </DragOverlay>
        </DndContext>
      </BlockActionsProvider>
    </DragPreviewProvider>
  );
}

/**
 * BlockOverlay — the floating preview shown while dragging. Renders the same
 * visual as TimeBlockCard but statically positioned (no absolute) so it sits
 * correctly under the cursor inside <DragOverlay>.
 */
function BlockOverlay({ block }: { block: TimeBlock }) {
  const height = Math.max(16, (block.endMinutes - block.startMinutes) * 2);
  const typeDef = getBlockType(block.blockType);
  const range = `${minLabel(block.startMinutes)} – ${minLabel(block.endMinutes)}`;
  return (
    <div
      // Semi-transparent so the in-grid destination shadow (the real preview)
      // stands out as the focal point.
      className={`w-64 rounded-md border-l-4 px-2 py-1 shadow-lg opacity-80 ${typeDef.style}`}
      style={{ height }}
    >
      <div className="flex h-full flex-col gap-0.5 overflow-hidden">
        <div className="flex min-w-0 items-center gap-1">
          <span className={`mt-1 size-1.5 shrink-0 rounded-full ${typeDef.dot}`} />
          <h4 className="truncate text-xs font-semibold leading-tight">{block.title}</h4>
        </div>
        {height >= 44 && (
          <p className="pl-2.5 text-[10px] font-medium tabular-nums opacity-70">{range}</p>
        )}
      </div>
    </div>
  );
}

function minLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const period = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}
