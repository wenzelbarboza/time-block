/**
 * Block type definitions — the single source of truth for time-block
 * categories. Used by the card, overlay, dialog, legend, and DB defaults.
 *
 * Colors are chosen to be distinct and readable. Avoiding indigo/blue per the
 * project style guide, EXCEPT "DEEP" which keeps its signature blue to match
 * Cal Newport's "Deep Work" branding (deep work = the focal, protected time).
 */

import {
  Brain,
  Coffee,
  Mail,
  Users,
  Dumbbell,
  Utensils,
  BookOpen,
  Phone,
  Plane,
  type LucideIcon,
} from "lucide-react";

export interface BlockTypeDefinition {
  /** Stored value in the DB. */
  value: string;
  /** Human label shown in UI. */
  label: string;
  /** Tailwind classes for the block body (bg + border + text). */
  style: string;
  /** Tailwind class for the status dot. */
  dot: string;
  /** Lucide icon for the legend / dialog. */
  icon: LucideIcon;
}

export const BLOCK_TYPES: BlockTypeDefinition[] = [
  {
    value: "DEEP",
    label: "Deep Work",
    style: "bg-blue-100 border-blue-500 text-blue-900",
    dot: "bg-blue-500",
    icon: Brain,
  },
  {
    value: "SHALLOW",
    label: "Shallow",
    style: "bg-gray-100 border-gray-400 text-gray-800",
    dot: "bg-gray-400",
    icon: Mail,
  },
  {
    value: "MEETING",
    label: "Meeting",
    style: "bg-orange-100 border-orange-500 text-orange-900",
    dot: "bg-orange-500",
    icon: Users,
  },
  {
    value: "LEARN",
    label: "Learning",
    style: "bg-emerald-100 border-emerald-500 text-emerald-900",
    dot: "bg-emerald-500",
    icon: BookOpen,
  },
  {
    value: "BREAK",
    label: "Break",
    style: "bg-teal-100 border-teal-500 text-teal-900",
    dot: "bg-teal-500",
    icon: Coffee,
  },
  {
    value: "EMAIL",
    label: "Email & Admin",
    style: "bg-amber-100 border-amber-500 text-amber-900",
    dot: "bg-amber-500",
    icon: Mail,
  },
  {
    value: "CALL",
    label: "Call",
    style: "bg-cyan-100 border-cyan-500 text-cyan-900",
    dot: "bg-cyan-500",
    icon: Phone,
  },
  {
    value: "EXERCISE",
    label: "Exercise",
    style: "bg-rose-100 border-rose-500 text-rose-900",
    dot: "bg-rose-500",
    icon: Dumbbell,
  },
  {
    value: "MEAL",
    label: "Meal",
    style: "bg-lime-100 border-lime-500 text-lime-900",
    dot: "bg-lime-500",
    icon: Utensils,
  },
  {
    value: "TRAVEL",
    label: "Travel",
    style: "bg-violet-100 border-violet-500 text-violet-900",
    dot: "bg-violet-500",
    icon: Plane,
  },
];

const BY_VALUE = new Map(BLOCK_TYPES.map((t) => [t.value, t]));

/** Get a block type definition by value, falling back to DEEP. */
export function getBlockType(value: string): BlockTypeDefinition {
  return BY_VALUE.get(value) ?? BLOCK_TYPES[0];
}

/** All block type values (for type unions / validation). */
export const BLOCK_TYPE_VALUES = BLOCK_TYPES.map((t) => t.value) as [
  string,
  ...string[]
];

/** Default block type for new blocks. */
export const DEFAULT_BLOCK_TYPE = "DEEP";
