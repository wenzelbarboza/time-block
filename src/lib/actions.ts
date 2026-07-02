"use server";

/**
 * Time-Block Planner — Server Actions.
 *
 * All DB access goes through here so client components never touch Prisma
 * directly. Each action is a thin, typed wrapper around `db`.
 */

import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export type BlockType = string;
export type CaptureType = "TASK" | "IDEA";

/** Get the currently logged-in user or throw an error if unauthenticated. */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.email) {
    throw new Error("Unauthorized");
  }
  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

/** Register a new user with hashed password. */
export async function registerUser(email: string, passwordStr: string, name?: string) {
  if (!email || !passwordStr) {
    throw new Error("Email and password are required");
  }

  const existing = await db.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("A user with this email address already exists");
  }

  const hashedPassword = await bcrypt.hash(passwordStr, 10);

  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name ?? null,
    },
  });

  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Normalized date string (YYYY-MM-DD) to a UTC-midnight Date.
 * Kept async because every export of a "use server" module must be async.
 */
export async function normalizeDate(dateStr: string): Promise<Date> {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Fetch the DayPlan for a given date, or create an empty one if none exists.
 * Always returns the full nested graph (blocks, captures, metrics).
 */
export async function fetchOrCreateDayPlan(dateStr: string) {
  const user = await getCurrentUser();
  const date = await normalizeDate(dateStr);
  
  // upsert on the compound unique key: [date, userId]
  const plan = await db.dayPlan.upsert({
    where: {
      date_userId: { date, userId: user.id },
    },
    update: {},
    create: { date, userId: user.id },
    include: {
      timeBlocks: { orderBy: { startMinutes: "asc" } },
      capturedItems: { orderBy: { id: "asc" } },
      metrics: { orderBy: { id: "asc" } },
    },
  });
  return plan;
}

/**
 * List ALL day plans (for the history view) with summary stats per day.
 * Returns one row per day, newest first, including block/capture counts and
 * the deep-work metric value.
 */
export async function listDayPlanSummaries() {
  const user = await getCurrentUser();
  const plans = await db.dayPlan.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { timeBlocks: true, capturedItems: true } },
      timeBlocks: { select: { startMinutes: true, endMinutes: true, blockType: true } },
      metrics: { select: { name: true, value: true } },
    },
  });
  return plans.map((p) => {
    const totalMinutes = p.timeBlocks.reduce(
      (sum, b) => sum + (b.endMinutes - b.startMinutes),
      0
    );
    const deepMinutes = p.timeBlocks
      .filter((b) => b.blockType === "DEEP")
      .reduce((sum, b) => sum + (b.endMinutes - b.startMinutes), 0);
    const deepWorkHours = p.metrics.find((m) => m.name === "Hours of Deep Work")?.value ?? "";
    return {
      id: p.id,
      date: p.date,
      shutdownComplete: p.shutdownComplete,
      currentRevisionIndex: p.currentRevisionIndex,
      dayEndMinutes: p.dayEndMinutes,
      blockCount: p._count.timeBlocks,
      captureCount: p._count.capturedItems,
      totalMinutes,
      deepMinutes,
      deepWorkHours,
    };
  });
}

/** Seed a few demo blocks so the grid isn't empty on first load. */
export async function seedDemoBlocks(dayPlanId: string, revisionIndex = 0) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  const existing = await db.timeBlock.count({ where: { dayPlanId } });
  if (existing > 0) return false;
  await db.timeBlock.createMany({
    data: [
      {
        dayPlanId,
        title: "Deep Work: Writing",
        description: "Draft Chapter 3 intro\nOutline key arguments\nWrite 1,000 words",
        blockType: "DEEP",
        startMinutes: 450, // 7:30 AM
        endMinutes: 570, // 9:30 AM
        revisionIndex,
      },
      {
        dayPlanId,
        title: "Coffee Break",
        blockType: "BREAK",
        startMinutes: 570, // 9:30 AM
        endMinutes: 585, // 9:45 AM
        revisionIndex,
      },
      {
        dayPlanId,
        title: "Inbox Triage",
        description: "Reply to client emails\nFlag urgent threads\nArchive newsletters",
        blockType: "EMAIL",
        startMinutes: 585, // 9:45 AM
        endMinutes: 630, // 10:30 AM
        revisionIndex,
      },
      {
        dayPlanId,
        title: "Team Standup",
        description: "Share yesterday's progress\nBlockers: API rate limit\nDemo new feature",
        blockType: "MEETING",
        startMinutes: 660, // 11:00 AM
        endMinutes: 690, // 11:30 AM
        revisionIndex,
      },
      {
        dayPlanId,
        title: "Lunch",
        blockType: "MEAL",
        startMinutes: 720, // 12:00 PM
        endMinutes: 750, // 12:30 PM
        revisionIndex,
      },
      {
        dayPlanId,
        title: "Deep Work: Coding",
        description: "Fix auth bug #421\nRefactor payment module\nWrite unit tests",
        blockType: "DEEP",
        startMinutes: 750, // 12:30 PM
        endMinutes: 870, // 2:30 PM
        revisionIndex,
      },
      {
        dayPlanId,
        title: "Read Research Paper",
        blockType: "LEARN",
        startMinutes: 890, // 2:50 PM
        endMinutes: 950, // 3:50 PM
        revisionIndex,
      },
    ],
  });
  return true;
}

// ---------------------------------------------------------------------------
// TimeBlock actions
// ---------------------------------------------------------------------------

export async function createTimeBlock(input: {
  dayPlanId: string;
  title: string;
  description?: string;
  blockType: BlockType;
  startMinutes: number;
  endMinutes: number;
  revisionIndex: number;
}) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: input.dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  return db.timeBlock.create({
    data: { ...input, description: input.description ?? "" },
  });
}

export async function updateTimeBlock(
  id: string,
  updates: {
    startMinutes?: number;
    endMinutes?: number;
    title?: string;
    description?: string;
    blockType?: string;
  }
) {
  const user = await getCurrentUser();
  const block = await db.timeBlock.findFirst({
    where: { id, dayPlan: { userId: user.id } },
  });
  if (!block) throw new Error("Unauthorized");

  return db.timeBlock.update({ where: { id }, data: updates });
}

export async function deleteTimeBlock(id: string) {
  const user = await getCurrentUser();
  const block = await db.timeBlock.findFirst({
    where: { id, dayPlan: { userId: user.id } },
  });
  if (!block) throw new Error("Unauthorized");

  return db.timeBlock.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Capture actions
// ---------------------------------------------------------------------------

export async function createCapture(input: {
  dayPlanId: string;
  text: string;
  type: CaptureType;
}) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: input.dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  return db.capture.create({ data: input });
}

export async function toggleCaptureHandled(id: string, isHandled: boolean) {
  const user = await getCurrentUser();
  const capture = await db.capture.findFirst({
    where: { id, dayPlan: { userId: user.id } },
  });
  if (!capture) throw new Error("Unauthorized");

  return db.capture.update({ where: { id }, data: { isHandled } });
}

export async function deleteCapture(id: string) {
  const user = await getCurrentUser();
  const capture = await db.capture.findFirst({
    where: { id, dayPlan: { userId: user.id } },
  });
  if (!capture) throw new Error("Unauthorized");

  return db.capture.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Metric actions
// ---------------------------------------------------------------------------

export async function upsertMetric(input: {
  dayPlanId: string;
  name: string;
  value: string;
}) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: input.dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  const existing = await db.metric.findFirst({
    where: { dayPlanId: input.dayPlanId, name: input.name },
  });
  if (existing) {
    return db.metric.update({ where: { id: existing.id }, data: { value: input.value } });
  }
  return db.metric.create({ data: input });
}

export async function deleteMetric(id: string) {
  const user = await getCurrentUser();
  const metric = await db.metric.findFirst({
    where: { id, dayPlan: { userId: user.id } },
  });
  if (!metric) throw new Error("Unauthorized");

  return db.metric.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// DayPlan-level actions
// ---------------------------------------------------------------------------

export async function pivotSchedule(dayPlanId: string) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  return db.dayPlan.update({
    where: { id: dayPlanId },
    data: { currentRevisionIndex: plan.currentRevisionIndex + 1 },
  });
}

export async function undoPivot(dayPlanId: string) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: dayPlanId, userId: user.id },
    include: { timeBlocks: { select: { revisionIndex: true } } },
  });
  if (!plan) throw new Error("DayPlan not found or unauthorized");
  if (plan.currentRevisionIndex <= 0) {
    throw new Error("Nothing to undo");
  }
  const hasBlocks = plan.timeBlocks.some(
    (b) => b.revisionIndex === plan.currentRevisionIndex
  );
  if (hasBlocks) {
    throw new Error("Cannot undo: the latest revision has blocks. Delete them first.");
  }
  return db.dayPlan.update({
    where: { id: dayPlanId },
    data: { currentRevisionIndex: plan.currentRevisionIndex - 1 },
  });
}

export async function toggleShutdown(dayPlanId: string, shutdownComplete: boolean) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  return db.dayPlan.update({
    where: { id: dayPlanId },
    data: { shutdownComplete },
  });
}

export async function updateDayEnd(dayPlanId: string, dayEndMinutes: number) {
  const user = await getCurrentUser();
  const plan = await db.dayPlan.findFirst({
    where: { id: dayPlanId, userId: user.id },
  });
  if (!plan) throw new Error("Unauthorized");

  const clamped = Math.max(0, Math.min(1440, Math.round(dayEndMinutes)));
  return db.dayPlan.update({
    where: { id: dayPlanId },
    data: { dayEndMinutes: clamped },
  });
}
