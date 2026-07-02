/**
 * Update the user's configurable end-of-day time.
 * POST /api/planner/day-end  body: { dayPlanId, dayEndMinutes }
 */
import { NextRequest, NextResponse } from "next/server";
import { updateDayEnd } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.dayPlanId || typeof body.dayEndMinutes !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const plan = await updateDayEnd(body.dayPlanId, body.dayEndMinutes);
  return NextResponse.json(plan);
}
