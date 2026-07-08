"use client";

/**
 * Time-Block Planner — Zustand store.
 *
 * Holds the active day plan and an optimistic overlay for time blocks so that
 * drag/resize feels instant. Optimistic updates are committed to the DB via
 * Server Actions.
 */

import { create } from "zustand";
import { api, type DayPlanSummary } from "@/lib/api-client";

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
  activeDateStr: string | null;
  cachedDayPlans: Record<string, DayPlan>;
  isLoading: Record<string, boolean>;
  /** Overlay of block mutations applied on top of activeDayPlan.timeBlocks. */
  optimisticBlocks: Record<string, Partial<TimeBlock>>;
  historySummaries: DayPlanSummary[] | null;
  historyLoading: boolean;
  setActiveDayPlan: (plan: DayPlan | null, dateStr?: string) => void;
  fetchDayPlan: (dateStr: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
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
  activeDateStr: null,
  cachedDayPlans: {},
  isLoading: {},
  optimisticBlocks: {},
  historySummaries: null,
  historyLoading: false,

  setActiveDayPlan: (plan, dateStr) =>
    set((state) => {
      const updates: Partial<PlannerStore> = {
        activeDayPlan: plan,
        optimisticBlocks: {},
      };
      if (dateStr) {
        updates.activeDateStr = dateStr;
        if (plan) {
          updates.cachedDayPlans = {
            ...state.cachedDayPlans,
            [dateStr]: plan,
          };
        }
      }
      return updates;
    }),

  fetchHistory: async () => {
    const { historySummaries } = get();
    if (historySummaries !== null) return; // already cached
    set({ historyLoading: true });
    try {
      const data = await api.fetchHistory();
      set({ historySummaries: data });
    } catch (err) {
      console.error("Failed to fetch history:", err);
      set({ historySummaries: [] });
    } finally {
      set({ historyLoading: false });
    }
  },

  fetchDayPlan: async (dateStr) => {
    const { cachedDayPlans } = get();

    // 1. If we have the plan cached, set it immediately (0ms transition)
    if (cachedDayPlans[dateStr]) {
      set({ activeDayPlan: cachedDayPlans[dateStr], activeDateStr: dateStr });
    } else {
      // 2. Otherwise set loading for this date and fetch
      set((state) => ({
        isLoading: { ...state.isLoading, [dateStr]: true },
        activeDateStr: dateStr,
      }));

      try {
        const plan = await api.fetchDayPlan(dateStr);
        const parsedPlan: DayPlan = {
          ...plan,
          date: new Date(plan.date),
        };
        set((state) => ({
          activeDayPlan: parsedPlan,
          cachedDayPlans: { ...state.cachedDayPlans, [dateStr]: parsedPlan },
        }));
      } catch (err) {
        console.error("Failed to fetch day plan:", err);
      } finally {
        set((state) => ({
          isLoading: { ...state.isLoading, [dateStr]: false },
        }));
      }
    }

    // 3. Prefetch next/prev days in the background
    try {
      const currentDate = new Date(`${dateStr}T00:00:00.000Z`);
      const prevDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      const prevDateStr = prevDate.toISOString().split("T")[0];
      const nextDateStr = nextDate.toISOString().split("T")[0];

      const prefetch = async (dStr: string) => {
        const { cachedDayPlans: currentCache, isLoading: currentLoading } = get();
        if (currentCache[dStr] || currentLoading[dStr]) return;
        try {
          const plan = await api.fetchDayPlan(dStr);
          const parsedPlan: DayPlan = {
            ...plan,
            date: new Date(plan.date),
          };
          set((state) => ({
            cachedDayPlans: { ...state.cachedDayPlans, [dStr]: parsedPlan },
          }));
        } catch {
          // ignore prefetch errors
        }
      };

      prefetch(prevDateStr);
      prefetch(nextDateStr);
    } catch {
      // ignore date calculation errors
    }
  },

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
    set((state) => {
      if (!state.activeDayPlan) return {};
      const updatedPlan = { ...state.activeDayPlan, timeBlocks: blocks };
      return {
        activeDayPlan: updatedPlan,
        optimisticBlocks: {},
      };
    }),

  addBlock: (block) =>
    set((state) => {
      if (!state.activeDayPlan) return {};
      const updatedPlan = {
        ...state.activeDayPlan,
        timeBlocks: [...state.activeDayPlan.timeBlocks, block],
      };
      return {
        activeDayPlan: updatedPlan,
      };
    }),

  removeBlock: (id) =>
    set((state) => {
      if (!state.activeDayPlan) return {};
      const updatedPlan = {
        ...state.activeDayPlan,
        timeBlocks: state.activeDayPlan.timeBlocks.filter((b) => b.id !== id),
      };
      return {
        activeDayPlan: updatedPlan,
      };
    }),

  patchDayPlan: (updates) =>
    set((state) => {
      if (!state.activeDayPlan) return {};
      const updatedPlan = { ...state.activeDayPlan, ...updates };
      return {
        activeDayPlan: updatedPlan,
      };
    }),
}));

// Subscribe to activeDayPlan changes and update cachedDayPlans automatically
usePlannerStore.subscribe((state) => {
  if (state.activeDayPlan && state.activeDateStr) {
    // 1. Sync cachedDayPlans
    if (state.cachedDayPlans[state.activeDateStr] !== state.activeDayPlan) {
      state.cachedDayPlans[state.activeDateStr] = state.activeDayPlan;
    }

    // 2. Sync historySummaries if loaded
    if (state.historySummaries) {
      const plan = state.activeDayPlan;
      const dateStr = state.activeDateStr;

      const blockCount = plan.timeBlocks.length;
      const totalMinutes = plan.timeBlocks.reduce((sum, b) => sum + (b.endMinutes - b.startMinutes), 0);
      const deepMinutes = plan.timeBlocks
        .filter((b) => b.blockType === "DEEP")
        .reduce((sum, b) => sum + (b.endMinutes - b.startMinutes), 0);
      const deepWorkHours = plan.metrics.find((m) => m.name === "Hours of Deep Work")?.value ?? "";
      const captureCount = plan.capturedItems.length;

      const idx = state.historySummaries.findIndex(s => s.id === plan.id || s.date.startsWith(dateStr));
      const existing = idx !== -1 ? state.historySummaries[idx] : null;

      const hasChanged = !existing ||
        existing.shutdownComplete !== plan.shutdownComplete ||
        existing.currentRevisionIndex !== plan.currentRevisionIndex ||
        existing.dayEndMinutes !== plan.dayEndMinutes ||
        existing.blockCount !== blockCount ||
        existing.captureCount !== captureCount ||
        existing.totalMinutes !== totalMinutes ||
        existing.deepMinutes !== deepMinutes ||
        existing.deepWorkHours !== deepWorkHours;

      if (hasChanged) {
        const newSummary = {
          id: plan.id,
          date: existing ? existing.date : plan.date.toISOString(),
          shutdownComplete: plan.shutdownComplete,
          currentRevisionIndex: plan.currentRevisionIndex,
          dayEndMinutes: plan.dayEndMinutes,
          blockCount,
          captureCount,
          totalMinutes,
          deepMinutes,
          deepWorkHours,
        };

        const nextSummaries = [...state.historySummaries];
        if (idx !== -1) {
          nextSummaries[idx] = newSummary;
        } else {
          nextSummaries.unshift(newSummary);
          nextSummaries.sort((a, b) => b.date.localeCompare(a.date));
        }

        setTimeout(() => {
          usePlannerStore.setState({ historySummaries: nextSummaries });
        }, 0);
      }
    }
  }
});
