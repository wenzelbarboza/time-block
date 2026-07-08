"use client";

/**
 * MonthlyView — a calendar month grid where each day cell shows a mini summary
 * (block count, deep-work intensity, shutdown status).
 *
 * Fetches all day-plan summaries from /api/planner/history and filters to the
 * month containing the current date.
 */

import * as React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { Brain, CheckCircle2, Clock } from "lucide-react";

import { type DayPlanSummary } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePlannerStore } from "@/lib/planner-store";

interface MonthlyViewProps {
  currentDate: string;
  onSelectDay: (date: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthlyView({ currentDate, onSelectDay }: MonthlyViewProps) {
  const summaries = usePlannerStore((s) => s.historySummaries);
  const loading = usePlannerStore((s) => s.historyLoading || s.historySummaries === null);
  const fetchHistory = usePlannerStore((s) => s.fetchHistory);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const focusDate = parseISO(currentDate);
  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(focusDate);
  // Grid starts on the Monday of the week containing the 1st, ends on the
  // Sunday of the week containing the last day.
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDate = React.useMemo(() => {
    const map = new Map<string, DayPlanSummary>();
    for (const s of summaries ?? []) {
      map.set(s.date.slice(0, 10), s);
    }
    return map;
  }, [summaries]);

  // Monthly aggregate stats.
  const monthSummaries = days
    .filter((d) => isSameMonth(d, focusDate))
    .map((d) => byDate.get(format(d, "yyyy-MM-dd")))
    .filter((s): s is DayPlanSummary => s !== undefined);
  const totalDeep = monthSummaries.reduce((sum, s) => sum + s.deepMinutes, 0);
  const plannedDays = monthSummaries.length;
  const shutdowns = monthSummaries.filter((s) => s.shutdownComplete).length;
  const avgDeep = plannedDays > 0 ? totalDeep / plannedDays : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Monthly summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Planned Days" value={String(plannedDays)} />
        <SummaryCard
          label="Total Deep"
          value={`${(totalDeep / 60).toFixed(1)}h`}
        />
        <SummaryCard
          label="Avg Deep/Day"
          value={`${(avgDeep / 60).toFixed(1)}h`}
        />
        <SummaryCard label="Shutdowns" value={`${shutdowns}/${plannedDays}`} />
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="m-0.5 aspect-square rounded" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const s = byDate.get(dateStr);
              const inMonth = isSameMonth(day, focusDate);
              const isToday = isSameDay(day, new Date());
              return (
                <DayCell
                  key={dateStr}
                  day={day}
                  summary={s}
                  inMonth={inMonth}
                  isToday={isToday}
                  onClick={() => onSelectDay(dateStr)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/30 p-3 text-center">
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function DayCell({
  day,
  summary,
  inMonth,
  isToday,
  onClick,
}: {
  day: Date;
  summary?: DayPlanSummary;
  inMonth: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  // Deep-work intensity for background color (0h → faint, 4h+ → strong).
  const deepHours = summary ? summary.deepMinutes / 60 : 0;
  const intensity = Math.min(1, deepHours / 4);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-20 flex-col items-start gap-0.5 border-b border-r p-1.5 text-left transition-colors hover:bg-accent/40",
        !inMonth && "bg-muted/20 opacity-50"
      )}
      style={
        summary && inMonth
          ? { backgroundColor: `rgba(59, 130, 246, ${intensity * 0.18})` }
          : undefined
      }
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            isToday && "bg-primary text-primary-foreground"
          )}
        >
          {format(day, "d")}
        </span>
        {summary?.shutdownComplete && (
          <CheckCircle2 className="size-3 text-green-500" />
        )}
      </div>

      {summary && inMonth && (
        <div className="flex flex-col gap-0.5 text-[9px] leading-tight text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="size-2.5" />
            {summary.blockCount}
          </span>
          {deepHours > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-blue-700 dark:text-blue-300">
              <Brain className="size-2.5" />
              {deepHours.toFixed(1)}h
            </span>
          )}
        </div>
      )}
    </button>
  );
}
