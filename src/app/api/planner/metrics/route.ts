/**
 * Metric upsert/delete via API.
 * POST   /api/planner/metrics            -> upsert by (dayPlanId, name)
 * DELETE /api/planner/metrics?id=<id>    -> delete
 */
import { NextRequest, NextResponse } from "next/server";
import { upsertMetric, deleteMetric } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dayPlanId, name, value } = body ?? {};
  if (!dayPlanId || !name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const metric = await upsertMetric({
    dayPlanId,
    name,
    value: typeof value === "string" ? value : "",
  });
  return NextResponse.json(metric, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteMetric(id);
  return NextResponse.json({ ok: true });
}
