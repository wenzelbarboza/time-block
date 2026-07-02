/**
 * Toggle shutdown complete.
 * POST /api/planner/shutdown  body: { dayPlanId, shutdownComplete }
 */
import { NextRequest, NextResponse } from "next/server";
import { toggleShutdown } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.dayPlanId || typeof body.shutdownComplete !== "boolean") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const plan = await toggleShutdown(body.dayPlanId, body.shutdownComplete);
  return NextResponse.json(plan);
}
