/**
 * Undo the most recent pivot: decrements currentRevisionIndex by one.
 * Only allowed when the latest revision column is empty (no blocks to lose).
 * POST /api/planner/pivot-undo  body: { dayPlanId }
 */
import { NextRequest, NextResponse } from "next/server";
import { undoPivot } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.dayPlanId) {
    return NextResponse.json({ error: "Missing dayPlanId" }, { status: 400 });
  }
  try {
    const plan = await undoPivot(body.dayPlanId);
    return NextResponse.json(plan);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Undo failed";
    // 409 Conflict is appropriate when the column isn't empty / nothing to undo.
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
