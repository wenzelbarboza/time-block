"use client";

/**
 * WeeklyView — a 7-day overview showing each day's blocks as a mini timeline
 * plus per-day and weekly summary stats.
 *
 * Fetches all day-plan summaries from /api/planner/history and filters to the
 * week containing the current date.
 */

import * as React from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addDays,
  parseISO,
} from "date-fns";
import { Brain, CheckCircle2, Clock } from "lucide-react";

import { type DayPlanSummary } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getBlockType } from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { usePlannerStore } from "@/lib/planner-store";

interface WeeklyViewProps {
  currentDate: string;
  onSelectDay: (date: string) => void;
}

export function WeeklyView({ currentDate, onSelectDay }: WeeklyViewProps) {
  const summaries = usePlannerStore((s) => s.historySummaries);
  const loading = usePlannerStore((s) => s.historyLoading || s.historySummaries === null);
  const fetchHistory = usePlannerStore((s) => s.fetchHistory);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const focusDate = parseISO(currentDate);
  const weekStart = startOfWeek(focusDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Index summaries by YYYY-MM-DD for quick lookup.
  const byDate = React.useMemo(() => {
    const map = new Map<string, DayPlanSummary>();
    for (const s of summaries ?? []) {
      map.set(s.date.slice(0, 10), s);
    }
    return map;
  }, [summaries]);

  // Weekly aggregate stats.
  const weekSummaries = days
    .map((d) => byDate.get(format(d, "yyyy-MM-dd")))
    .filter((s): s is DayPlanSummary => s !== undefined);
  const totalDeep = weekSummaries.reduce((sum, s) => sum + s.deepMinutes, 0);
  const totalBlocks = weekSummaries.reduce((sum, s) => sum + s.blockCount, 0);
  const shutdowns = weekSummaries.filter((s) => s.shutdownComplete).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Weekly summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          icon={<Clock className="size-4" />}
          label="Total Blocks"
          value={String(totalBlocks)}
        />
        <SummaryCard
          icon={<Brain className="size-4" />}
          label="Deep Work"
          value={`${(totalDeep / 60).toFixed(1)}h`}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Shutdowns"
          value={`${shutdowns}/7`}
        />
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))
          : days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const s = byDate.get(dateStr);
              return (
                <DayColumn
                  key={dateStr}
                  day={day}
                  summary={s}
                  isCurrent={isSameDay(day, focusDate)}
                  onClick={() => onSelectDay(dateStr)}
                />
              );
            })}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 p-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** A single day column with a mini timeline. */
function DayColumn({
  day,
  summary,
  isCurrent,
  onClick,
}: {
  day: Date;
  summary?: DayPlanSummary;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
        isCurrent && "border-primary ring-1 ring-primary/30",
        isWeekend && "bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {format(day, "EEE")}
          </p>
          <p className="text-lg font-bold tabular-nums">{format(day, "d")}</p>
        </div>
        {summary?.shutdownComplete && (
          <CheckCircle2 className="size-4 text-green-500" />
        )}
      </div>

      {/* Mini timeline (showing blocks as colored bars) */}
      <MiniTimeline summary={summary} />

      {/* Stats */}
      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        {summary ? (
          <>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {summary.blockCount} blocks
            </span>
            <span className="flex items-center gap-1">
              <Brain className="size-3" />
              {(summary.deepMinutes / 60).toFixed(1)}h deep
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/50">No plan</span>
        )}
      </div>
    </button>
  );
}

/**
 * MiniTimeline — a compact visual of the day's blocks. Each block is a thin
 * colored bar positioned by its time within the 24-hour day.
 */
function MiniTimeline({ summary }: { summary?: DayPlanSummary }) {
  if (!summary) {
    return <div className="h-16 rounded bg-muted/40" />;
  }
  // We don't have individual block data in the summary, so show a proportional
  // deep-work bar based on deepMinutes vs totalMinutes.
  const totalMin = 1440; // 24h
  const deepPct = (summary.deepMinutes / totalMin) * 100;
  const totalPct = (summary.totalMinutes / totalMin) * 100;

  return (
    <div className="relative h-16 overflow-hidden rounded bg-muted/30">
      {/* Total scheduled (lighter bar from bottom) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-blue-200/50"
        style={{ height: `${totalPct}%` }}
      />
      {/* Deep work (darker bar on top) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-blue-500/70"
        style={{ height: `${deepPct}%` }}
      />
      {/* Hour gridlines */}
      {[6, 12, 18].map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 h-px bg-border/40"
          style={{ top: `${(h / 24) * 100}%` }}
        />
      ))}
    </div>
  );
}
