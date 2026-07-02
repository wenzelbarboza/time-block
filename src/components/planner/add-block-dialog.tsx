"use client";

/**
 * AddBlockDialog — modal for creating a new time block.
 *
 * Pre-filled with the clicked minute (from the column's clientY math) and a
 * default 60-minute duration. Lets the user set a title, block type, and
 * start time / duration. On save, calls the API and adds the block to the
 * Zustand store optimistically.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlannerStore, type TimeBlock } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  clampToGrid,
  minutesToTimeInput,
  minutesToTimeLabel,
  snapTo15,
  timeInputToMinutes,
} from "@/lib/timeUtils";
import { BLOCK_TYPES, DEFAULT_BLOCK_TYPE } from "@/lib/block-types";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

interface AddBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startMinutes: number;
  revisionIndex: number;
}

export function AddBlockDialog({
  open,
  onOpenChange,
  startMinutes,
  revisionIndex,
}: AddBlockDialogProps) {
  const { toast } = useToast();
  const addBlock = usePlannerStore((s) => s.addBlock);
  const dayPlan = usePlannerStore((s) => s.activeDayPlan);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<string>(DEFAULT_BLOCK_TYPE);
  const [start, setStart] = React.useState(startMinutes);
  const [duration, setDuration] = React.useState(60);
  const [saving, setSaving] = React.useState(false);

  // Sync local state when the dialog opens with new clicked minute.
  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setType(DEFAULT_BLOCK_TYPE);
      setStart(snapTo15(clampToGrid(startMinutes)));
      setDuration(60);
    }
  }, [open, startMinutes]);

  const end = Math.min(start + duration, GRID_END_MINUTES);
  const overlapsEnd = start + duration > GRID_END_MINUTES;

  const handleStartChange = (value: string) => {
    // The native <input type="time"> gives "HH:MM". Parse + snap + clamp.
    const m = timeInputToMinutes(value);
    if (m !== null) setStart(snapTo15(clampToGrid(m)));
  };

  const handleSave = async () => {
    if (!dayPlan) return;
    const trimmed = title.trim() || "Untitled Block";
    const finalEnd = Math.min(start + duration, GRID_END_MINUTES);
    if (finalEnd <= start) {
      toast({ title: "Invalid duration", variant: "destructive" });
      return;
    }
    setSaving(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: TimeBlock = {
      id: tempId,
      dayPlanId: dayPlan.id,
      title: trimmed,
      description: description.trim(),
      blockType: type,
      startMinutes: start,
      endMinutes: finalEnd,
      revisionIndex,
    };
    addBlock(optimistic);
    onOpenChange(false);

    try {
      const created = await api.createBlock({
        dayPlanId: dayPlan.id,
        title: trimmed,
        description: description.trim(),
        blockType: type,
        startMinutes: start,
        endMinutes: finalEnd,
        revisionIndex,
      });
      // Swap temp for real.
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              timeBlocks: s.activeDayPlan.timeBlocks.map((b) =>
                b.id === tempId ? created : b
              ),
            }
          : s.activeDayPlan,
      }));
    } catch {
      // Rollback.
      usePlannerStore.setState((s) => ({
        activeDayPlan: s.activeDayPlan
          ? {
              ...s.activeDayPlan,
              timeBlocks: s.activeDayPlan.timeBlocks.filter(
                (b) => b.id !== tempId
              ),
            }
          : s.activeDayPlan,
      }));
      toast({ title: "Couldn't create block", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Time Block</DialogTitle>
          <DialogDescription>
            Revision {revisionIndex} · {minutesToTimeLabel(start)} –{" "}
            {minutesToTimeLabel(end)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-title">Title</Label>
            <Input
              id="block-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deep Work: Writing"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) handleSave();
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-description">
              Description{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional — subtasks, agenda, notes)
              </span>
            </Label>
            <Textarea
              id="block-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"e.g. Draft Chapter 3 intro\nOutline key arguments\nWrite 1,000 words"}
              className="min-h-20 resize-y text-sm"
              onKeyDown={(e) => {
                // Enter inserts a newline (default textarea); Ctrl/Cmd+Enter saves.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !saving) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-start">Start</Label>
              <input
                id="block-start"
                type="time"
                value={minutesToTimeInput(start)}
                onChange={(e) => handleStartChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-duration">Duration</Label>
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
              >
                <SelectTrigger id="block-duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d < 60
                        ? `${d} min`
                        : d % 60 === 0
                        ? `${d / 60} hr`
                        : `${Math.floor(d / 60)}h ${d % 60}m`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Block type</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {BLOCK_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.value}
                    type="button"
                    variant={type === t.value ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-center gap-1"
                    onClick={() => setType(t.value)}
                  >
                    <Icon className="size-3" />
                    <span className="truncate">{t.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {overlapsEnd && (
            <p className="text-xs text-amber-600">
              End time clamped to 7:00 PM (grid end).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Adding…" : "Add Block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
