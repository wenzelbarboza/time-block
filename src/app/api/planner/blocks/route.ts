/**
 * Time-block CRUD via API.
 * POST   /api/planner/blocks            -> create
 * PATCH  /api/planner/blocks?id=<id>    -> update (move/resize/title/type)
 * DELETE /api/planner/blocks?id=<id>    -> delete
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createTimeBlock, updateTimeBlock, deleteTimeBlock } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dayPlanId, title, description, blockType, startMinutes, endMinutes, revisionIndex } = body ?? {};
  if (!dayPlanId || !title || typeof startMinutes !== "number" || typeof endMinutes !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const block = await createTimeBlock({
    dayPlanId,
    title,
    description: typeof description === "string" ? description : "",
    blockType: blockType ?? "DEEP",
    startMinutes,
    endMinutes,
    revisionIndex: revisionIndex ?? 0,
  });
  return NextResponse.json(block, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const k of ["startMinutes", "endMinutes", "title", "description", "blockType"]) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  const block = await updateTimeBlock(id, updates);
  return NextResponse.json(block);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteTimeBlock(id);
  return NextResponse.json({ ok: true });
}
