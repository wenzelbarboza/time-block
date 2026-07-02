/**
 * Capture CRUD via API.
 * POST   /api/planner/captures            -> create
 * PATCH  /api/planner/captures?id=<id>    -> toggle handled / edit
 * DELETE /api/planner/captures?id=<id>    -> delete
 */
import { NextRequest, NextResponse } from "next/server";
import { createCapture, toggleCaptureHandled, deleteCapture } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dayPlanId, text, type } = body ?? {};
  if (!dayPlanId || !text) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const item = await createCapture({
    dayPlanId,
    text,
    type: type === "IDEA" ? "IDEA" : "TASK",
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json();
  const item = await toggleCaptureHandled(id, Boolean(body.isHandled));
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteCapture(id);
  return NextResponse.json({ ok: true });
}
