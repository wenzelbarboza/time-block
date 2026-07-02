/**
 * Pivot the schedule: increment currentRevisionIndex.
 * POST /api/planner/pivot  body: { dayPlanId }
 */
import { NextRequest, NextResponse } from "next/server";
import { pivotSchedule } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.dayPlanId) {
    return NextResponse.json({ error: "Missing dayPlanId" }, { status: 400 });
  }
  const plan = await pivotSchedule(body.dayPlanId);
  return NextResponse.json(plan);
}
