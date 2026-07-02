"use client";

/**
 * DuplicateToDateDialog — lets the user pick a target date and copy a block
 * there (same time, type, title, description).
 *
 * Opens from the right-click context menu's "Duplicate to date…" option.
 * The actual copy is performed by the `onCopy` prop (passed by PivotGrid),
 * which calls the API to fetch/create the target day's plan + create the block.
 */

import * as React from "react";
import { format, parseISO, addDays } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatBlockRange } from "@/lib/timeUtils";
import type { TimeBlock } from "@/lib/planner-store";

interface DuplicateToDateDialogProps {
  block: TimeBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Performs the copy. Returns the target date string on success, null on
   * failure. Provided by PivotGrid (which has access to the API).
   */
  onCopy: (block: TimeBlock, dateStr: string) => Promise<string | null>;
  /** Called after a successful copy, with the target date — offers to navigate. */
  onCopied?: (dateStr: string) => void;
}

export function DuplicateToDateDialog({
  block,
  open,
  onOpenChange,
  onCopy,
  onCopied,
}: DuplicateToDateDialogProps) {
  // Default target = tomorrow.
  const [targetDate, setTargetDate] = React.useState(
    format(addDays(new Date(), 1), "yyyy-MM-dd")
  );
  const [copying, setCopying] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTargetDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    }
  }, [open]);

  if (!block) return null;

  const handleCopy = async () => {
    if (!block) return;
    setCopying(true);
    const result = await onCopy(block, targetDate);
    setCopying(false);
    if (result) {
      onOpenChange(false);
      onCopied?.(result);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate to date</DialogTitle>
          <DialogDescription>
            Copy &ldquo;{block.title}&rdquo; ({formatBlockRange(block.startMinutes, block.endMinutes)}) to another day.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-date">Target date</Label>
            <input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
          </div>

          {/* Quick-pick buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTargetDate(format(new Date(), "yyyy-MM-dd"))}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTargetDate(format(addDays(new Date(), 1), "yyyy-MM-dd"))}
            >
              Tomorrow
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTargetDate(format(addDays(new Date(), 2), "yyyy-MM-dd"))}
            >
              In 2 days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTargetDate(format(addDays(new Date(), 7), "yyyy-MM-dd"))}
            >
              Next week
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            The block will be copied with the same time, type, and description.
            You can edit it after navigating to that day.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={copying}
          >
            Cancel
          </Button>
          <Button onClick={handleCopy} disabled={copying || !targetDate}>
            {copying ? "Copying…" : `Copy to ${format(parseISO(targetDate), "MMM d")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
