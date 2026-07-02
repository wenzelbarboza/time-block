"use client";

/**
 * CapturePanel — distraction capture (Cal Newport's "capture").
 *
 * A text input with a TASK/IDEA toggle. Items appear in a list below with a
 * "processed" checkbox. Optimistic updates flow through the Zustand store;
 * persistence goes through server actions.
 */

import * as React from "react";
import { Lightbulb, ListTodo, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { usePlannerStore } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function CapturePanel({ disabled }: { disabled?: boolean }) {
  const { toast } = useToast();
  const dayPlan = usePlannerStore((s) => s.activeDayPlan);
  const [text, setText] = React.useState("");
  const [type, setType] = React.useState<"TASK" | "IDEA">("TASK");
  const [pending, setPending] = React.useState(false);

  const items = dayPlan?.capturedItems ?? [];

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || !dayPlan) return;
    setPending(true);
    // Optimistic: append a temp item immediately.
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = {
      id: tempId,
      dayPlanId: dayPlan.id,
      text: trimmed,
      type,
      isHandled: false,
    };
    usePlannerStore.setState((s) => ({
      activeDayPlan: s.activeDayPlan
        ? {
            ...s.activeDayPlan,
            capturedItems: [...s.activeDayPlan.capturedItems, optimisticItem],
          }
        : s.activeDayPlan,
    }));
    setText("");

    try {
      const created = await api.createCapture({
        dayPlanId: dayPlan.id,
        text: trimmed,
        type,
      });
      // Swap temp for the real record.
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              capturedItems: s.activeDayPlan.capturedItems.map((c) =>
                c.id === tempId ? created : c
              ),
            }
          : s.activeDayPlan,
      }));
    } catch {
      // Roll back on failure.
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              capturedItems: s.activeDayPlan.capturedItems.filter(
                (c) => c.id !== tempId
              ),
            }
          : s.activeDayPlan,
      }));
      toast({
        title: "Couldn't save capture",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleToggle = async (id: string, next: boolean) => {
    // Optimistic flip.
    usePlannerStore.setState((s) => ({
      activeDayPlan: s.activeDayPlan
        ? {
            ...s.activeDayPlan,
            capturedItems: s.activeDayPlan.capturedItems.map((c) =>
              c.id === id ? { ...c, isHandled: next } : c
            ),
          }
        : s.activeDayPlan,
    }));
    try {
      await api.toggleCapture(id, next);
    } catch {
      // Revert.
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              capturedItems: s.activeDayPlan.capturedItems.map((c) =>
                c.id === id ? { ...c, isHandled: !next } : c
              ),
            }
          : s.activeDayPlan,
      }));
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const prev = dayPlan?.capturedItems ?? [];
    usePlannerStore.setState((s) => ({
      activeDayPlan: s.activeDayPlan
        ? {
            ...s.activeDayPlan,
            capturedItems: s.activeDayPlan.capturedItems.filter(
              (c) => c.id !== id
            ),
          }
        : s.activeDayPlan,
    }));
    try {
      await api.deleteCapture(id);
    } catch {
      // Restore.
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? { ...s.activeDayPlan, capturedItems: prev }
          : s.activeDayPlan,
      }));
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const open = items.filter((c) => !c.isHandled);
  const done = items.filter((c) => c.isHandled);

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-4" />
          Capture
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => v && setType(v as "TASK" | "IDEA")}
            variant="outline"
            className="w-full"
            disabled={disabled}
          >
            <ToggleGroupItem value="TASK" className="gap-1.5">
              <ListTodo className="size-3.5" /> Task
            </ToggleGroupItem>
            <ToggleGroupItem value="IDEA" className="gap-1.5">
              <Lightbulb className="size-3.5" /> Idea
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder={
                type === "TASK" ? "Capture a task…" : "Capture an idea…"
              }
              disabled={disabled || pending}
              aria-label="Capture text"
            />
            <Button
              size="icon"
              onClick={handleAdd}
              disabled={disabled || pending || !text.trim()}
              aria-label="Add capture"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {items.length === 0 && (
            <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
              No captures yet. Log distractions without context-switching.
            </p>
          )}
          {open.length > 0 && (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Open · {open.length}
            </span>
          )}
          {open.map((c) => (
            <CaptureRow
              key={c.id}
              id={c.id}
              text={c.text}
              type={c.type}
              isHandled={c.isHandled}
              disabled={disabled}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}

          {done.length > 0 && (
            <>
              <Separator className="my-1" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Processed · {done.length}
              </span>
              {done.map((c) => (
                <CaptureRow
                  key={c.id}
                  id={c.id}
                  text={c.text}
                  type={c.type}
                  isHandled={c.isHandled}
                  disabled={disabled}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CaptureRow({
  id,
  text,
  type,
  isHandled,
  disabled,
  onToggle,
  onDelete,
}: {
  id: string;
  text: string;
  type: string;
  isHandled: boolean;
  disabled?: boolean;
  onToggle: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-md border bg-card px-2.5 py-2 text-sm">
      <Checkbox
        id={`cap-${id}`}
        checked={isHandled}
        onCheckedChange={(v) => onToggle(id, v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={`cap-${id}`}
          className={`block cursor-pointer text-sm leading-snug ${
            isHandled ? "text-muted-foreground line-through" : ""
          }`}
        >
          {text}
        </Label>
        <span
          className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            type === "TASK"
              ? "bg-blue-100 text-blue-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {type}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onDelete(id)}
        disabled={disabled}
        aria-label="Delete capture"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
