"use client";

/**
 * PivotGrid — the multi-column daily time-block grid.
 *
 * Layout: a flex row with a fixed-width <TimeAxis> on the left and a
 * <GridContainer> on the right (flex w-full h-[1440px] relative). For each
 * revisionIndex 0..currentRevisionIndex, a <GridColumn> is rendered.
 *
 * Features (Step 4, read-only):
 *  - Hour-scaled axis + gridlines (1 min = 2 px).
 *  - Blocks positioned absolutely inside their revision column.
 *  - Current-time red indicator line across the grid.
 *  - "Pivot Schedule" button: increments currentRevisionIndex; blocks in older
 *    columns whose endMinutes > now get opacity-40 line-through; a new empty
 *    column appears on the right.
 *  - "Add Block" dialog via clientY math (delegated to GridColumn).
 *  - Delete block.
 *
 * Step 5 will wrap this in <DndContext> and make columns useDroppable.
 */

import * as React from "react";
import { Repeat, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePlannerStore, type TimeBlock, type DayPlan } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  GRID_END_MINUTES,
  GRID_HEIGHT_PX,
  GRID_START_MINUTES,
  DEFAULT_DAY_END_MINUTES,
  clampToGrid,
  minutesToPixels,
  minutesToTimeInput,
  nowMinutes,
  timeInputToMinutes,
} from "@/lib/timeUtils";
import { BLOCK_TYPES, getBlockType } from "@/lib/block-types";
import { TimeAxis } from "@/components/planner/time-axis";
import { DroppableColumn } from "@/components/planner/droppable-column";
import { AddBlockDialog } from "@/components/planner/add-block-dialog";
import { EditBlockDialog } from "@/components/planner/edit-block-dialog";
import { DuplicateToDateDialog } from "@/components/planner/duplicate-to-date-dialog";
import { PlannerDndContext } from "@/components/planner/planner-dnd-context";

interface PivotGridProps {
  /** Authoritative day plan from the server (used for SSR + first client render). */
  dayPlan: DayPlan;
  disabled?: boolean;
}

export function PivotGrid({ dayPlan, disabled }: PivotGridProps) {
  const { toast } = useToast();
  // Prefer the store (powers live mutations); fall back to the server prop so
  // SSR and the first client render are correct with no hydration mismatch.
  const storeDayPlan = usePlannerStore((s) => s.activeDayPlan);
  const activeDayPlan = storeDayPlan ?? dayPlan;
  const patchDayPlan = usePlannerStore((s) => s.patchDayPlan);
  const removeBlock = usePlannerStore((s) => s.removeBlock);

  // "now" is computed on the client only (after mount) so it uses the user's
  // browser timezone and avoids SSR/client hydration mismatch.
  const [now, setNow] = React.useState<number | null>(null);
  const [dialog, setDialog] = React.useState<{
    open: boolean;
    startMinutes: number;
    revisionIndex: number;
  }>({ open: false, startMinutes: 540, revisionIndex: 0 });
  const [editBlock, setEditBlock] = React.useState<TimeBlock | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [dupToDateBlock, setDupToDateBlock] = React.useState<TimeBlock | null>(null);
  const [dupToDateOpen, setDupToDateOpen] = React.useState(false);

  // Set the current time on mount and tick every 30s.
  React.useEffect(() => {
    setNow(nowMinutes());
    const id = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll the grid so the current time line is centered on first load.
  // Runs once when `now` is first determined (client-side, after mount).
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const didAutoScroll = React.useRef(false);
  React.useEffect(() => {
    if (didAutoScroll.current || now === null || !scrollRef.current) return;
    didAutoScroll.current = true;
    const nowTop = minutesToPixels(clampToGrid(now));
    const container = scrollRef.current;
    // Center the current-time line within the visible scroll area.
    container.scrollTo({
      top: Math.max(0, nowTop - container.clientHeight / 2),
      behavior: "auto",
    });
  }, [now]);

  const currentRevisionIndex = activeDayPlan.currentRevisionIndex;
  const revisions = Array.from(
    { length: currentRevisionIndex + 1 },
    (_, i) => i
  );

  // Group blocks by their revision index (cheap: a handful of blocks).
  const blocksByRevision: Record<number, TimeBlock[]> = {};
  for (const r of revisions) blocksByRevision[r] = [];
  for (const b of activeDayPlan.timeBlocks) {
    if (!blocksByRevision[b.revisionIndex]) blocksByRevision[b.revisionIndex] = [];
    blocksByRevision[b.revisionIndex].push(b);
  }
  for (const r of revisions) {
    blocksByRevision[r].sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // Whether the latest (newest) revision column is empty — undo pivot is only
  // allowed when there are no blocks to lose.
  const canUndoPivot =
    currentRevisionIndex > 0 &&
    (blocksByRevision[currentRevisionIndex]?.length ?? 0) === 0;

  // Legend: show the block types actually present in today's plan (in order).
  // If the plan is empty, show all types so the user knows what's available.
  const usedTypeValues = Array.from(
    new Set(activeDayPlan.timeBlocks.map((b) => b.blockType))
  );
  const legendTypes =
    usedTypeValues.length > 0
      ? usedTypeValues
          .map((v) => getBlockType(v))
          // Keep the canonical order from BLOCK_TYPES.
          .sort(
            (a, b) =>
              BLOCK_TYPES.findIndex((t) => t.value === a.value) -
              BLOCK_TYPES.findIndex((t) => t.value === b.value)
          )
      : BLOCK_TYPES;

  const handleAddBlock = (revisionIndex: number, startMinutes: number) => {
    setDialog({ open: true, startMinutes, revisionIndex });
  };

  const handleEditBlock = (block: TimeBlock) => {
    setEditBlock(block);
    setEditOpen(true);
  };

  const handleDuplicateToDate = (block: TimeBlock) => {
    setDupToDateBlock(block);
    setDupToDateOpen(true);
  };

  // Perform the actual copy to another date: fetch/create the target day's
  // plan, then create a block there with the same details.
  const handleCopyBlockToDate = async (
    block: TimeBlock,
    dateStr: string
  ): Promise<string | null> => {
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
  };

  // Update the configurable end-of-day time (debounced persistence).
  const dayEndTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDayEndChange = (minutes: number) => {
    patchDayPlan({ dayEndMinutes: minutes });
    if (dayEndTimeout.current) clearTimeout(dayEndTimeout.current);
    dayEndTimeout.current = setTimeout(async () => {
      try {
        await api.updateDayEnd(activeDayPlan.id, minutes);
      } catch {
        toast({ title: "Couldn't save end-of-day", variant: "destructive" });
      }
    }, 500);
  };

  const handlePivot = async () => {
    if (disabled) return;
    const next = currentRevisionIndex + 1;
    patchDayPlan({ currentRevisionIndex: next });
    try {
      await api.pivot(activeDayPlan.id);
      toast({
        title: `Pivoted to revision ${next}`,
        description: "Past blocks are struck through; plan your next moves.",
      });
    } catch {
      patchDayPlan({ currentRevisionIndex: currentRevisionIndex });
      toast({ title: "Pivot failed", variant: "destructive" });
    }
  };

  const handleUndoPivot = async () => {
    if (disabled) return;
    const prev = currentRevisionIndex - 1;
    // Optimistic: roll back the revision immediately.
    patchDayPlan({ currentRevisionIndex: prev });
    try {
      await api.undoPivot(activeDayPlan.id);
      toast({
        title: `Undid pivot — back to revision ${prev}`,
        description: "The empty column was removed.",
      });
    } catch (e) {
      // Restore on failure (e.g. column wasn't actually empty).
      patchDayPlan({ currentRevisionIndex });
      toast({
        title: "Couldn't undo pivot",
        description: e instanceof Error ? e.message : "The latest revision may have blocks.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (disabled) return;
    removeBlock(id);
    try {
      await api.deleteBlock(id);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const nowInGrid =
    now !== null && now >= GRID_START_MINUTES && now <= GRID_END_MINUTES;
  const nowTop = now !== null ? minutesToPixels(clampToGrid(now)) : 0;

  // Configurable end-of-day.
  const dayEndMinutes = activeDayPlan.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES;
  const dayEndTop = minutesToPixels(clampToGrid(dayEndMinutes));

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="flex-row items-center justify-between border-b py-3">
        <div>
          <CardTitle className="text-base">Daily Schedule</CardTitle>
          <p className="text-xs text-muted-foreground">
            {now === null
              ? "Loading current time…"
              : `Now: ${formatNow(now)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* End-of-day control */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="day-end"
              className="hidden text-xs font-medium text-muted-foreground sm:inline"
            >
              Day ends
            </label>
            <input
              id="day-end"
              type="time"
              value={minutesToTimeInput(dayEndMinutes)}
              onChange={(e) => {
                const m = timeInputToMinutes(e.target.value);
                if (m !== null) handleDayEndChange(m);
              }}
              disabled={disabled}
              className="h-8 w-[5.5rem] rounded-md border bg-transparent px-2 text-xs tabular-nums shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              aria-label="End of day"
            />
          </div>
          {currentRevisionIndex > 0 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <Button
                      onClick={handleUndoPivot}
                      disabled={disabled || !canUndoPivot}
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      aria-label="Undo pivot"
                    >
                      <Undo2 className="size-4" />
                      <span className="hidden sm:inline">Undo Pivot</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {canUndoPivot
                    ? "Remove the empty column and go back one revision"
                    : "Delete the blocks in the latest column first, then undo"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            onClick={handlePivot}
            disabled={disabled}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Repeat className="size-4" />
            Pivot Schedule
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "70vh" }}>
          <div className="flex">
            <TimeAxis nowMin={now ?? 0} />
            <PlannerDndContext dayPlan={activeDayPlan} disabled={disabled}>
              <div
                className="relative flex w-full"
                style={{ height: GRID_HEIGHT_PX }}
              >
                {revisions.map((r) => (
                  <DroppableColumn
                    key={r}
                    revisionIndex={r}
                    currentRevisionIndex={currentRevisionIndex}
                    blocks={blocksByRevision[r] ?? []}
                    now={now}
                    disabled={disabled}
                    onAddBlock={handleAddBlock}
                    onDeleteBlock={handleDeleteBlock}
                    onEditBlock={handleEditBlock}
                    onDuplicateToDate={handleDuplicateToDate}
                  />
                ))}

                {/* End-of-day indicator line (emerald) across the whole grid */}
                <div
                  className="pointer-events-none absolute left-0 right-0 z-10 h-px bg-emerald-600/70"
                  style={{ top: dayEndTop }}
                  aria-label={`End of day ${formatNow(dayEndMinutes)}`}
                >
                  <span className="absolute -left-1 -top-1 size-3 rounded-full bg-emerald-600 ring-2 ring-background" />
                  <span className="absolute left-2 -top-4 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                    Day end · {formatNow(dayEndMinutes)}
                  </span>
                </div>

                {/* Current-time red indicator line across the whole grid */}
                {nowInGrid && now !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 h-1 bg-red-500"
                    style={{ top: nowTop }}
                    aria-label={`Current time ${formatNow(now)}`}
                  >
                    <span className="absolute -left-1 -top-1 size-3 rounded-full bg-red-500 ring-2 ring-background" />
                  </div>
                )}
              </div>
            </PlannerDndContext>
          </div>
        </div>

        {/* Legend — shows the block types present in today's plan (or all
            types if none yet), plus drag hints. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1.5">
            {legendTypes.map((t) => {
              const Icon = t.icon;
              return (
                <span key={t.value} className="flex items-center gap-1.5">
                  <span className={`size-3 rounded border-l-4 ${t.style}`} />
                  {t.label}
                </span>
              );
            })}
          </div>
          <span className="ml-auto hidden items-center gap-1.5 md:flex">
            <Trash2 className="size-3" /> Drag to move/resize · Ctrl+Drag or right-click to duplicate · Click a block to edit · Click empty space to add
          </span>
          <span className="ml-auto items-center gap-1.5 md:hidden">
            <Trash2 className="size-3" /> Tap empty space to add
          </span>
        </div>
      </CardContent>

      <AddBlockDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        startMinutes={dialog.startMinutes}
        revisionIndex={dialog.revisionIndex}
      />
      <EditBlockDialog
        block={editBlock}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DuplicateToDateDialog
        block={dupToDateBlock}
        open={dupToDateOpen}
        onOpenChange={setDupToDateOpen}
        onCopy={handleCopyBlockToDate}
        onCopied={(dateStr) => {
          // Offer to navigate to the target date after copying.
          const go = window.confirm(
            `Block copied to ${dateStr}. Navigate to that day now?`
          );
          if (go) window.location.href = `/?date=${dateStr}`;
        }}
      />
    </Card>
  );
}

function formatNow(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const period = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}
