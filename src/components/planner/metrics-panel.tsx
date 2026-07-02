"use client";

/**
 * MetricsPanel — daily tracking inputs (e.g. "Hours of Deep Work").
 *
 * Default metrics are seeded from the store if absent. Each row persists via
 * the `upsertMetric` server action with optimistic state.
 */

import * as React from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { usePlannerStore } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_METRICS = [
  "Hours of Deep Work",
  "Hours of Shallow Work",
  "Book Pages Read",
];

export function MetricsPanel({ disabled }: { disabled?: boolean }) {
  const { toast } = useToast();
  const dayPlan = usePlannerStore((s) => s.activeDayPlan);
  const [newName, setNewName] = React.useState("");
  const [newValue, setNewValue] = React.useState("");

  // Seed default metrics on first mount if none exist (client-side, persisted).
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current || !dayPlan) return;
    seededRef.current = true;
    if (dayPlan.metrics.length === 0) {
      // Optimistically add empty rows.
      const placeholders = DEFAULT_METRICS.map((name) => ({
        id: `temp-${name}`,
        dayPlanId: dayPlan.id,
        name,
        value: "",
      }));
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? { ...s.activeDayPlan, metrics: placeholders }
          : s.activeDayPlan,
      }));
      // Persist each default metric (empty value) so they have stable IDs.
      Promise.all(
        DEFAULT_METRICS.map((name) =>
          api.upsertMetric({ dayPlanId: dayPlan.id, name, value: "" })
        )
      )
        .then((created) => {
          usePlannerStore.setState((s) => ({
            activeDayPlan: s.activeDayPlan
              ? { ...s.activeDayPlan, metrics: created }
              : s.activeDayPlan,
          }));
        })
        .catch(() => {
          toast({ title: "Couldn't init metrics", variant: "destructive" });
        });
    }
  }, [dayPlan, toast]);

  const metrics = dayPlan?.metrics ?? [];

  const updateValue = async (id: string, name: string, value: string) => {
    if (!dayPlan) return;
    // Optimistic update.
    usePlannerStore.setState((s) => ({
      activeDayPlan: s.activeDayPlan
        ? {
            ...s.activeDayPlan,
            metrics: s.activeDayPlan.metrics.map((m) =>
              m.id === id ? { ...m, value } : m
            ),
          }
        : s.activeDayPlan,
    }));
    try {
      await api.upsertMetric({ dayPlanId: dayPlan.id, name, value });
    } catch {
      toast({ title: "Couldn't save metric", variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !dayPlan) return;
    const tempId = `temp-${Date.now()}`;
    usePlannerStore.setState((s) => ({
      activeDayPlan: s.activeDayPlan
        ? {
            ...s.activeDayPlan,
            metrics: [
              ...s.activeDayPlan.metrics,
              { id: tempId, dayPlanId: dayPlan.id, name, value: newValue },
            ],
          }
        : s.activeDayPlan,
    }));
    setNewName("");
    setNewValue("");
    try {
      const created = await api.upsertMetric({
        dayPlanId: dayPlan.id,
        name,
        value: newValue,
      });
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              metrics: s.activeDayPlan.metrics.map((m) =>
                m.id === tempId ? created : m
              ),
            }
          : s.activeDayPlan,
      }));
    } catch {
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              metrics: s.activeDayPlan.metrics.filter((m) => m.id !== tempId),
            }
          : s.activeDayPlan,
      }));
      toast({ title: "Couldn't add metric", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const prev = dayPlan?.metrics ?? [];
    usePlannerStore.setState((s) => ({
      activeDayPlan: s.activeDayPlan
        ? {
            ...s.activeDayPlan,
            metrics: s.activeDayPlan.metrics.filter((m) => m.id !== id),
          }
        : s.activeDayPlan,
    }));
    try {
      await api.deleteMetric(id);
    } catch {
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? { ...s.activeDayPlan, metrics: prev }
          : s.activeDayPlan,
      }));
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" />
          Daily Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          {metrics.map((m) => (
            <div
              key={m.id}
              className="group flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5"
            >
              <Label
                htmlFor={`metric-${m.id}`}
                className="min-w-0 flex-1 truncate text-sm"
                title={m.name}
              >
                {m.name}
              </Label>
              <Input
                id={`metric-${m.id}`}
                value={m.value}
                onChange={(e) => updateValue(m.id, m.name, e.target.value)}
                disabled={disabled}
                placeholder="—"
                className="h-8 w-20 text-right"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleDelete(m.id)}
                disabled={disabled}
                aria-label={`Delete ${m.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {metrics.length === 0 && (
            <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              Loading metrics…
            </p>
          )}
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New metric name"
            disabled={disabled}
            className="h-8"
            aria-label="New metric name"
          />
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value"
            disabled={disabled}
            className="h-8 w-20 text-right"
            aria-label="New metric value"
          />
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            onClick={handleAdd}
            disabled={disabled || !newName.trim()}
            aria-label="Add metric"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
