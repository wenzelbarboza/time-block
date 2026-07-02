"use client";

/**
 * PlannerShell — the interactive client root.
 *
 * Supports three view modes:
 *  - daily:   the full time-block grid + capture/metrics sidebar (default)
 *  - weekly:  a 7-day overview with mini timelines + summary stats
 *  - monthly: a calendar month grid with per-day stats
 *
 * The date is controlled by ?date=YYYY-MM-DD; the view mode is local state.
 * Prev/next navigation respects the view (±1 day / ±7 days / ±1 month).
 */

import { useEffect, useState } from "react";
import {
  format,
  parseISO,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  isToday as isDateToday,
} from "date-fns";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlannerStore, type DayPlan } from "@/lib/planner-store";
import { CapturePanel } from "@/components/planner/capture-panel";
import { MetricsPanel } from "@/components/planner/metrics-panel";
import { ShutdownControl } from "@/components/planner/shutdown-control";
import { PivotGrid } from "@/components/planner/pivot-grid";
import { HistoryPanel } from "@/components/planner/history-panel";
import { WeeklyView } from "@/components/planner/weekly-view";
import { MonthlyView } from "@/components/planner/monthly-view";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";

type ViewMode = "daily" | "weekly" | "monthly";

interface PlannerShellProps {
  dayPlan: DayPlan;
  dateStr: string;
}

export function PlannerShell({ dayPlan, dateStr }: PlannerShellProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const setActiveDayPlan = usePlannerStore((s) => s.setActiveDayPlan);
  const activeDayPlan = usePlannerStore((s) => s.activeDayPlan);
  const [view, setView] = useState<ViewMode>("daily");

  // Hydrate the store on the client. SSR + first client render use the prop
  // directly (passed to PivotGrid) so there's no hydration mismatch; the store
  // takes over once hydrated to power live mutations.
  useEffect(() => {
    setActiveDayPlan(dayPlan);
  }, [dayPlan, setActiveDayPlan]);

  const currentDate = parseISO(dateStr);

  // Header date label adapts to the view.
  const displayDate = (() => {
    try {
      if (view === "weekly") {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
        const we = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
      }
      if (view === "monthly") {
        return format(currentDate, "MMMM yyyy");
      }
      return format(currentDate, "EEEE, MMMM d, yyyy");
    } catch {
      return dateStr;
    }
  })();

  const revisionIndex = activeDayPlan?.currentRevisionIndex ?? dayPlan.currentRevisionIndex;
  const shutdownComplete = activeDayPlan?.shutdownComplete ?? dayPlan.shutdownComplete;

  // Navigate to a different date by updating the URL query param.
  const navigateToDate = (date: Date) => {
    const newDateStr = format(date, "yyyy-MM-dd");
    window.location.href = `/?date=${newDateStr}`;
  };

  // Prev/next respects the view mode.
  const handlePrev = () => {
    if (view === "weekly") navigateToDate(addDays(currentDate, -7));
    else if (view === "monthly") navigateToDate(addMonths(currentDate, -1));
    else navigateToDate(addDays(currentDate, -1));
  };
  const handleNext = () => {
    if (view === "weekly") navigateToDate(addDays(currentDate, 7));
    else if (view === "monthly") navigateToDate(addMonths(currentDate, 1));
    else navigateToDate(addDays(currentDate, 1));
  };

  const navigateToDay = (d: string) => {
    setView("daily");
    navigateToDate(parseISO(d));
  };

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col transition-colors",
        shutdownComplete && view === "daily" && "border-2 border-green-500"
      )}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Time-Block Planner</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {displayDate}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border bg-muted/40 p-0.5">
              {(["daily", "weekly", "monthly"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    view === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Date navigation */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handlePrev}
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" />
              </Button>
              {/* Jump to today — only shown when not already on today */}
              {!isDateToday(currentDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs font-medium"
                  onClick={() => navigateToDate(new Date())}
                  aria-label="Jump to today"
                >
                  <CalendarCheck className="size-3.5" />
                  <span className="hidden sm:inline">Today</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleNext}
                aria-label="Next"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {view === "daily" && (
              <span className="hidden rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">
                Revision {revisionIndex}
              </span>
            )}
            <HistoryPanel currentDate={dateStr} onSelectDate={navigateToDay} />
            {view === "daily" && (
              <Button
                variant={shutdownComplete ? "outline" : "secondary"}
                size="sm"
                className={shutdownComplete ? "border-green-500 text-green-600" : ""}
                disabled
              >
                {shutdownComplete ? "Shutdown Complete" : "Shutdown Pending"}
              </Button>
            )}
            {user && (
              <div className="flex items-center gap-3 border-l pl-3 ml-1">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-xs font-semibold text-foreground leading-tight">
                    {user.name || user.email?.split("@")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {user.email}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body — adapts to the view */}
      {view === "daily" ? (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
          {/* Left column — Capture & Metrics */}
          <aside className="w-full shrink-0 space-y-4 lg:w-80">
            <CapturePanel disabled={shutdownComplete} />
            <MetricsPanel disabled={shutdownComplete} />
            <ShutdownControl />
          </aside>
          {/* Right column — Time-Block Grid */}
          <main className="min-w-0 flex-1">
            <PivotGrid dayPlan={dayPlan} disabled={shutdownComplete} />
          </main>
        </div>
      ) : view === "weekly" ? (
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <WeeklyView currentDate={dateStr} onSelectDay={navigateToDay} />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <MonthlyView currentDate={dateStr} onSelectDay={navigateToDay} />
        </main>
      )}

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 text-center text-xs text-muted-foreground sm:px-6">
          Time-Block Planner · Inspired by Cal Newport&apos;s Deep Work · 1 minute = 2px
        </div>
      </footer>
    </div>
  );
}
