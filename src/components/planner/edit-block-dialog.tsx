"use client";

/**
 * EditBlockDialog — view/edit an existing time block's details.
 *
 * Opens when a block is clicked (not dragged). Lets the user edit the title,
 * description, block type, and see the time range. Persists via the API with
 * optimistic updates through the Zustand store.
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
import { usePlannerStore, type TimeBlock } from "@/lib/planner-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { formatBlockRange } from "@/lib/timeUtils";
import { BLOCK_TYPES } from "@/lib/block-types";

interface EditBlockDialogProps {
  block: TimeBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBlockDialog({ block, open, onOpenChange }: EditBlockDialogProps) {
  const { toast } = useToast();
  const updateOptimisticBlock = usePlannerStore((s) => s.updateOptimisticBlock);
  const clearOptimisticBlock = usePlannerStore((s) => s.clearOptimisticBlock);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<string>("DEEP");
  const [saving, setSaving] = React.useState(false);

  // Sync local state whenever a different block is opened.
  React.useEffect(() => {
    if (open && block) {
      setTitle(block.title);
      setDescription(block.description ?? "");
      setType(block.blockType);
    }
  }, [open, block?.id]);

  if (!block) return null;

  const handleSave = async () => {
    if (!block) return;
    const trimmed = title.trim() || "Untitled Block";
    setSaving(true);
    // Optimistic update of the editable fields.
    updateOptimisticBlock(block.id, {
      title: trimmed,
      description: description.trim(),
      blockType: type,
    });
    try {
      await api.updateBlock(block.id, {
        title: trimmed,
        description: description.trim(),
        blockType: type,
      });
      onOpenChange(false);
    } catch {
      clearOptimisticBlock(block.id);
      toast({ title: "Couldn't save block", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Block</DialogTitle>
          <DialogDescription>
            {formatBlockRange(block.startMinutes, block.endMinutes)} · Revision{" "}
            {block.revisionIndex}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) handleSave();
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description">
              Description{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (subtasks, agenda, notes)
              </span>
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"e.g. Fix auth bug #421\nRefactor payment module\nWrite unit tests"}
              className="min-h-24 resize-y text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !saving) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
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
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
