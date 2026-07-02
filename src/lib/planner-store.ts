"use client";

/**
 * Time-Block Planner — Zustand store.
 *
 * Holds the active day plan and an optimistic overlay for time blocks so that
 * drag/resize feels instant. Optimistic updates are committed to the DB via
 * Server Actions.
 */

import { create } from "zustand";

export interface TimeBlock {
  id: string;
  dayPlanId: string;
  title: string;
  description: string;
  blockType: string;
  startMinutes: number;
  endMinutes: number;
  revisionIndex: number;
}

export interface Capture {
  id: string;
  dayPlanId: string;
  text: string;
  type: string;
  isHandled: boolean;
}

export interface Metric {
  id: string;
  dayPlanId: string;
  name: string;
  value: string;
}

export interface DayPlan {
  id: string;
  date: Date;
  shutdownComplete: boolean;
  currentRevisionIndex: number;
  dayEndMinutes: number;
  timeBlocks: TimeBlock[];
  capturedItems: Capture[];
  metrics: Metric[];
}

interface PlannerStore {
  activeDayPlan: DayPlan | null;
  /** Overlay of block mutations applied on top of activeDayPlan.timeBlocks. */
  optimisticBlocks: Record<string, Partial<TimeBlock>>;
  setActiveDayPlan: (plan: DayPlan | null) => void;
  /** Get the effective block (server data merged with optimistic patch). */
  getBlock: (id: string) => TimeBlock | undefined;
  /** Apply an optimistic patch to a block (e.g. during/after a drag). */
  updateOptimisticBlock: (id: string, updates: Partial<TimeBlock>) => void;
  /** Clear the optimistic patch for a block once the DB write is confirmed. */
  clearOptimisticBlock: (id: string) => void;
  /** Replace the whole blocks array (e.g. after creating/deleting). */
  setBlocks: (blocks: TimeBlock[]) => void;
  /** Add a new block to local state. */
  addBlock: (block: TimeBlock) => void;
  /** Remove a block from local state. */
  removeBlock: (id: string) => void;
  /** Update day-plan-level fields (pivot index, shutdown). */
  patchDayPlan: (updates: Partial<Pick<DayPlan, "currentRevisionIndex" | "shutdownComplete" | "dayEndMinutes">>) => void;
}

export const usePlannerStore = create<PlannerStore>((set, get) => ({
  activeDayPlan: null,
  optimisticBlocks: {},

  setActiveDayPlan: (plan) =>
    set({ activeDayPlan: plan, optimisticBlocks: {} }),

  getBlock: (id) => {
    const { activeDayPlan, optimisticBlocks } = get();
    if (!activeDayPlan) return undefined;
    const base = activeDayPlan.timeBlocks.find((b) => b.id === id);
    if (!base) return undefined;
    const patch = optimisticBlocks[id];
    return patch ? { ...base, ...patch } : base;
  },

  updateOptimisticBlock: (id, updates) =>
    set((state) => ({
      optimisticBlocks: {
        ...state.optimisticBlocks,
        [id]: { ...state.optimisticBlocks[id], ...updates },
      },
    })),

  clearOptimisticBlock: (id) =>
    set((state) => {
      const next = { ...state.optimisticBlocks };
      delete next[id];
      return { optimisticBlocks: next };
    }),

  setBlocks: (blocks) =>
    set((state) => ({
      activeDayPlan: state.activeDayPlan
        ? { ...state.activeDayPlan, timeBlocks: blocks }
        : state.activeDayPlan,
      optimisticBlocks: {},
    })),

  addBlock: (block) =>
    set((state) => ({
      activeDayPlan: state.activeDayPlan
        ? {
            ...state.activeDayPlan,
            timeBlocks: [...state.activeDayPlan.timeBlocks, block],
          }
        : state.activeDayPlan,
    })),

  removeBlock: (id) =>
    set((state) => ({
      activeDayPlan: state.activeDayPlan
        ? {
            ...state.activeDayPlan,
            timeBlocks: state.activeDayPlan.timeBlocks.filter((b) => b.id !== id),
          }
        : state.activeDayPlan,
    })),

  patchDayPlan: (updates) =>
    set((state) => ({
      activeDayPlan: state.activeDayPlan
        ? { ...state.activeDayPlan, ...updates }
        : state.activeDayPlan,
    })),
}));
