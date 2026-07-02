"use client";

/**
 * TimeAxis — the fixed-width left rail of the grid.
 *
 * Renders hour labels for the FULL 24-hour day (12:00 AM to 11:00 PM),
 * spaced every 120px (1 hour = 60 min × 2 px). Total height = 2880px.
 * Also hosts the current-time dot.
 */

import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  HOUR_HEIGHT_PX,
  minutesToPixels,
  minutesToTimeLabel,
  nowMinutes,
} from "@/lib/timeUtils";

export function TimeAxis({ nowMin }: { nowMin: number }) {
  // Generate one label per hour from start to end (inclusive of end label).
  const hours: number[] = [];
  for (let m = GRID_START_MINUTES; m <= GRID_END_MINUTES; m += 60) {
    hours.push(m);
  }

  const nowInGrid = nowMin >= GRID_START_MINUTES && nowMin <= GRID_END_MINUTES;
  const nowTop = minutesToPixels(nowMin);

  return (
    <div
      className="relative w-14 shrink-0 select-none sm:w-16"
      style={{ height: (GRID_END_MINUTES - GRID_START_MINUTES) * 2 }}
      aria-hidden="true"
    >
      {hours.map((m, i) => {
        const top = i * HOUR_HEIGHT_PX;
        // Skip drawing the final label's gridline (it's the bottom edge).
        return (
          <div
            key={m}
            className="absolute left-0 right-0"
            style={{ top, height: i === hours.length - 1 ? 0 : HOUR_HEIGHT_PX }}
          >
            {/* Hour label */}
            <span className="absolute -top-2 right-2 text-[11px] font-medium tabular-nums text-muted-foreground">
              {minutesToTimeLabel(m).replace(":00", "")}
            </span>
            {/* Horizontal gridline at the top of this hour slot */}
            <div className="absolute left-0 right-0 top-0 h-px bg-border/60" />
          </div>
        );
      })}

      {/* Current-time dot on the axis */}
      {nowInGrid && (
        <div
          className="absolute -right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-background"
          style={{ top: nowTop - 5 }}
        />
      )}
    </div>
  );
}

/** Re-export for the grid container to keep a single source of truth. */
export { nowMinutes };
