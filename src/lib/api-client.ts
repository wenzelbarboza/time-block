"use client";

/**
 * Client API layer for the Time-Block Planner.
 *
 * All requests use RELATIVE paths only (required by the Caddy gateway).
 * These wrap the /api/planner/* route handlers so client components never
 * touch server actions directly (avoids the proxied-origin validation issue).
 */

import type { DayPlan } from "@/lib/planner-store";

/** Summary stats for a single day (used in the history view). */
export interface DayPlanSummary {
  id: string;
  date: string; // ISO date string
  shutdownComplete: boolean;
  currentRevisionIndex: number;
  dayEndMinutes: number;
  blockCount: number;
  captureCount: number;
  totalMinutes: number;
  deepMinutes: number;
  deepWorkHours: string;
}

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  fetchDayPlan: (date: string) =>
    jfetch<DayPlan>(`/api/planner/dayplan?date=${encodeURIComponent(date)}`),

  fetchHistory: () =>
    jfetch<DayPlanSummary[]>(`/api/planner/history`),

  createBlock: (input: {
    dayPlanId: string;
    title: string;
    description?: string;
    blockType: string;
    startMinutes: number;
    endMinutes: number;
    revisionIndex: number;
  }) => jfetch(`/api/planner/blocks`, { method: "POST", body: JSON.stringify(input) }),

  updateBlock: (
    id: string,
    updates: {
      startMinutes?: number;
      endMinutes?: number;
      title?: string;
      description?: string;
      blockType?: string;
    }
  ) =>
    jfetch(`/api/planner/blocks?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteBlock: (id: string) =>
    jfetch(`/api/planner/blocks?id=${id}`, { method: "DELETE" }),

  createCapture: (input: { dayPlanId: string; text: string; type: "TASK" | "IDEA" }) =>
    jfetch(`/api/planner/captures`, { method: "POST", body: JSON.stringify(input) }),

  toggleCapture: (id: string, isHandled: boolean) =>
    jfetch(`/api/planner/captures?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isHandled }),
    }),

  deleteCapture: (id: string) =>
    jfetch(`/api/planner/captures?id=${id}`, { method: "DELETE" }),

  upsertMetric: (input: { dayPlanId: string; name: string; value: string }) =>
    jfetch(`/api/planner/metrics`, { method: "POST", body: JSON.stringify(input) }),

  deleteMetric: (id: string) =>
    jfetch(`/api/planner/metrics?id=${id}`, { method: "DELETE" }),

  pivot: (dayPlanId: string) =>
    jfetch(`/api/planner/pivot`, { method: "POST", body: JSON.stringify({ dayPlanId }) }),

  undoPivot: (dayPlanId: string) =>
    jfetch(`/api/planner/pivot-undo`, { method: "POST", body: JSON.stringify({ dayPlanId }) }),

  toggleShutdown: (dayPlanId: string, shutdownComplete: boolean) =>
    jfetch(`/api/planner/shutdown`, {
      method: "POST",
      body: JSON.stringify({ dayPlanId, shutdownComplete }),
    }),

  updateDayEnd: (dayPlanId: string, dayEndMinutes: number) =>
    jfetch(`/api/planner/day-end`, {
      method: "POST",
      body: JSON.stringify({ dayPlanId, dayEndMinutes }),
    }),
};
