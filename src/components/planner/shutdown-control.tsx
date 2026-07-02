"use client";

/**
 * ShutdownControl — the "Shutdown Complete" ritual.
 *
 * Toggling shutdown visually locks the UI (the root shell gains a green border
 * and all interactive panels receive `disabled`). Persisted via server action.
 */

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePlannerStore } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function ShutdownControl() {
  const { toast } = useToast();
  const dayPlan = usePlannerStore((s) => s.activeDayPlan);
  const patchDayPlan = usePlannerStore((s) => s.patchDayPlan);

  const shutdownComplete = dayPlan?.shutdownComplete ?? false;

  const handleToggle = async (next: boolean) => {
    if (!dayPlan) return;
    patchDayPlan({ shutdownComplete: next });
    try {
      await api.toggleShutdown(dayPlan.id, next);
      toast({
        title: next ? "Shutdown complete" : "Shutdown reopened",
        description: next
          ? "Your day is locked. Rest well."
          : "Back to planning.",
      });
    } catch {
      patchDayPlan({ shutdownComplete: !next });
      toast({ title: "Couldn't update shutdown", variant: "destructive" });
    }
  };

  return (
    <Card
      className={`gap-0 transition-colors ${
        shutdownComplete ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""
      }`}
    >
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className={`flex size-10 items-center justify-center rounded-full ${
            shutdownComplete
              ? "bg-green-500 text-white"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {shutdownComplete ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <Label
            htmlFor="shutdown"
            className="cursor-pointer text-sm font-semibold"
          >
            Shutdown Complete
          </Label>
          <p className="text-xs text-muted-foreground">
            {shutdownComplete
              ? "Day locked. Inputs disabled."
              : "Mark your day done to lock the planner."}
          </p>
        </div>
        <Checkbox
          id="shutdown"
          checked={shutdownComplete}
          onCheckedChange={(v) => handleToggle(v === true)}
          className="size-5"
        />
      </CardContent>
    </Card>
  );
}
