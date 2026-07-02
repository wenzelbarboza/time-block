/**
 * Home (server component) — entry route.
 *
 * Reads `?date=YYYY-MM-DD` (defaulting to today, in the user's timezone),
 * fetches-or-creates the matching DayPlan via a Server Action, and hands it
 * to the interactive <PlannerShell /> client component.
 */

import { format } from "date-fns";
import { PlannerShell } from "@/components/planner/planner-shell";
import { fetchOrCreateDayPlan } from "@/lib/actions";
import type { DayPlan } from "@/lib/planner-store";

export const dynamic = "force-dynamic";

function getDateString(searchParams: { date?: string }): string {
  if (searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)) {
    return searchParams.date;
  }
  // Default to today in the user's timezone (Asia/Calcutta).
  return format(new Date(), "yyyy-MM-dd");
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateStr = getDateString(params);

  // Fetch (or create) the day plan. New days start empty — no demo seeding.
  const plan = await fetchOrCreateDayPlan(dateStr);

  const clientPlan: DayPlan = {
    ...plan,
    date: plan.date,
  };

  return <PlannerShell dayPlan={clientPlan} dateStr={dateStr} />;
}
