/**
 * Time-Block Planner — time utilities.
 *
 * The grid uses a scale of 1 minute = 2px and renders the FULL 24-hour day
 * (12:00 AM = 0 min through 11:59 PM = 1439 min). The user can set their own
 * "end of day" (dayEndMinutes on the DayPlan) to mark when their workday ends.
 */

/** Minutes from midnight at which the grid starts (12:00 AM). */
export const GRID_START_MINUTES = 0;

/** Minutes from midnight at which the grid ends (11:59 PM ≈ 1440). */
export const GRID_END_MINUTES = 1440;

/** Pixels per minute — the single source of truth for the grid scale. */
export const PX_PER_MINUTE = 2;

/** Total grid height in pixels (24 hours * 60 min * 2 px). */
export const GRID_HEIGHT_PX = (GRID_END_MINUTES - GRID_START_MINUTES) * PX_PER_MINUTE; // 2880

/** Pixels per hour row (60 min * 2 px). */
export const HOUR_HEIGHT_PX = 120;

/** Number of hour rows in the grid (24). */
export const GRID_HOURS = (GRID_END_MINUTES - GRID_START_MINUTES) / 60; // 24

/** Default end-of-day in minutes from midnight (10:00 PM = 1320). */
export const DEFAULT_DAY_END_MINUTES = 1320;

/**
 * Convert a minutes-from-midnight value to a 12-hour time string.
 * @example minutesToTimeLabel(540) -> "9:00 AM"
 */
export function minutesToTimeLabel(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(clamped / 60);
  const m = Math.round(clamped % 60);
  const period = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Convert a 12-hour time string ("9:00 AM") to minutes from midnight.
 * Returns null when the string cannot be parsed.
 */
export function timeLabelToMinutes(label: string): number | null {
  const match = label.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3];
  if (period === "am") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return h * 60 + m;
}

/** Format a block's time range, e.g. "9:00 AM – 10:30 AM". */
export function formatBlockRange(startMinutes: number, endMinutes: number): string {
  return `${minutesToTimeLabel(startMinutes)} – ${minutesToTimeLabel(endMinutes)}`;
}

/** Format a duration as "1h 30m" / "45m" / "2h". */
export function formatDuration(startMinutes: number, endMinutes: number): string {
  const mins = Math.max(0, endMinutes - startMinutes);
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Current time as minutes from midnight (local). */
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Snap a minute value to the nearest 15-minute increment so blocks always
 * land on quarter-hour boundaries after a drag/resize.
 */
export function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/**
 * Clamp a minute value into the visible grid range.
 */
export function clampToGrid(minutes: number): number {
  return Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, minutes));
}

/**
 * Convert a Y pixel offset (relative to the top of a column) into minutes
 * from midnight, snapping to whole minutes.
 */
export function pixelsToMinutes(y: number): number {
  return Math.floor(y / PX_PER_MINUTE) + GRID_START_MINUTES;
}

/**
 * Convert minutes from midnight into a Y pixel offset within a column.
 */
export function minutesToPixels(minutes: number): number {
  return (minutes - GRID_START_MINUTES) * PX_PER_MINUTE;
}

/**
 * Convert minutes-from-midnight to an HTML <input type="time"> value "HH:MM".
 * @example minutesToTimeInput(540) -> "09:00"
 */
export function minutesToTimeInput(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = Math.round(clamped % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Convert an HTML <input type="time"> value "HH:MM" to minutes from midnight.
 * Returns null when the string can't be parsed.
 */
export function timeInputToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
