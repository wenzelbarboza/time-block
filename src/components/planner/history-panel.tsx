"use client";

/**
 * HistoryPanel — a slide-in Sheet showing past days and their performance
 * summaries.
 *
 * Opens via the "History" button in the header. Lists all day plans (newest
 * first) with per-day stats: block count, deep-work hours, captures, shutdown
 * status. Clicking a day navigates to it (?date=YYYY-MM-DD).
 */

import * as React from "react";
import { format, parseISO, isToday, differenceInCalendarDays } from "date-fns";
import {
  Brain,
  CheckCircle2,
  Clock,
  ListTodo,
  History as HistoryIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type DayPlanSummary } from "@/lib/api-client";
import { formatDuration } from "@/lib/timeUtils";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  /** The currently-viewed date (YYYY-MM-DD), to highlight in the list. */
  currentDate: string;
  /** Called when the user picks a day — navigates to ?date=YYYY-MM-DD. */
  onSelectDate: (date: string) => void;
}

export function HistoryPanel({ currentDate, onSelectDate }: HistoryPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [summaries, setSummaries] = React.useState<DayPlanSummary[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Fetch history when the panel opens.
  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchHistory();
      setSummaries(data);
    } catch {
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  const handleSelect = (date: string) => {
    onSelectDate(date);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <HistoryIcon className="size-4" />
          <span className="hidden sm:inline">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" />
            History
          </SheetTitle>
          <SheetDescription>
            Browse past days and review your performance.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!loading && summaries && summaries.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <HistoryIcon className="size-8 opacity-40" />
              <p>No past days yet.</p>
              <p className="text-xs">Start planning today — it'll show up here.</p>
            </div>
          )}

          {!loading && summaries && summaries.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* Aggregate stats at the top */}
              <AggregateStats summaries={summaries} />

              {summaries.map((s) => (
                <DaySummaryCard
                  key={s.id}
                  summary={s}
                  isCurrent={s.date.startsWith(currentDate)}
                  onSelect={() => handleSelect(s.date.slice(0, 10))}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Aggregate stats across all days. */
function AggregateStats({ summaries }: { summaries: DayPlanSummary[] }) {
  const totalDays = summaries.length;
  const totalDeepMinutes = summaries.reduce((s, d) => s + d.deepMinutes, 0);
  const shutdownDays = summaries.filter((d) => d.shutdownComplete).length;
  const avgDeep = totalDays > 0 ? totalDeepMinutes / totalDays : 0;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
      <div>
        <p className="text-lg font-bold tabular-nums">{totalDays}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Days
        </p>
      </div>
      <div>
        <p className="text-lg font-bold tabular-nums">
          {formatDuration(0, Math.round(avgDeep))}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Avg Deep/day
        </p>
      </div>
      <div>
        <p className="text-lg font-bold tabular-nums">{shutdownDays}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Shutdowns
        </p>
      </div>
    </div>
  );
}

/** A single day's summary row. */
function DaySummaryCard({
  summary,
  isCurrent,
  onSelect,
}: {
  summary: DayPlanSummary;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const date = parseISO(summary.date.slice(0, 10));
  const today = isToday(date);
  const daysAgo = differenceInCalendarDays(new Date(), date);
  const label = today
    ? "Today"
    : daysAgo === 1
    ? "Yesterday"
    : daysAgo > 0
    ? `${daysAgo} days ago`
    : `${Math.abs(daysAgo)} days ahead`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
        isCurrent && "border-primary ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {format(date, "EEE, MMM d")}
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        {summary.shutdownComplete && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <CheckCircle2 className="size-3" />
            Done
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {summary.blockCount} blocks
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Brain className="size-3" />
          {formatDuration(0, summary.deepMinutes)} deep
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <ListTodo className="size-3" />
          {summary.captureCount} captured
        </span>
      </div>

      {summary.deepWorkHours && (
        <p className="text-[11px] text-muted-foreground">
          Deep work logged:{" "}
          <span className="font-medium text-foreground">
            {summary.deepWorkHours}h
          </span>
        </p>
      )}
    </button>
  );
}
