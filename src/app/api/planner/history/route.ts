/**
 * GET /api/planner/history
 * Returns summary stats for ALL day plans (newest first) for the history view.
 */
import { NextResponse } from "next/server";
import { listDayPlanSummaries } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const summaries = await listDayPlanSummaries();
  return NextResponse.json(summaries);
}
