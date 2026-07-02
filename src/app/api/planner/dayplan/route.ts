/**
 * GET /api/planner/dayplan?date=YYYY-MM-DD
 * Fetch (or create) the day plan for a date, with nested blocks/captures/metrics.
 * New days start empty — no demo seeding.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchOrCreateDayPlan } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const plan = await fetchOrCreateDayPlan(date);
  return NextResponse.json(plan);
}
