// Floating bottom action bar that appears when N rows are selected.
// Excel-style: stays out of the way, surfaces actions at the bottom-
// center, dismisses on clear. Mobile: full-width along the bottom.
//
// Children = the action buttons. The bar handles count + clear UI.

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  count: number;
  onClear: () => void;
  children?: ReactNode;
  /** Optional label noun (singular). e.g. "operative" → "1 operative selected" */
  noun?: string;
}

export function BulkActionBar({ count, onClear, children, noun = "row" }: Props) {
  if (count === 0) return null;
  // Sit above the mobile bottom-nav (h-16) so it's tappable.
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 lg:bottom-6 z-30 w-[calc(100%-2rem)] max-w-2xl">
      <div className="bg-ink-900 text-white rounded-xl shadow-2xl flex items-center gap-2 px-4 py-2.5 lg:py-3">
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white shrink-0"
          title="Clear selection (Esc)"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium shrink-0">
          {count} {noun}{count === 1 ? "" : "s"} selected
        </div>
        <div className="flex-1 flex items-center justify-end gap-2 overflow-x-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// Tiny `Checkbox` styled to match the bulk-select pattern. Header checkbox
// renders a "minus" indicator when selection is partial (some rows
// selected but not all visible).
export function SelectCheckbox({
  checked,
  indeterminate = false,
  onToggle,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: (e: React.MouseEvent<HTMLInputElement>) => void;
  label?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate && !checked; }}
      onClick={onToggle}
      onChange={() => { /* handled in onClick to capture shift */ }}
      aria-label={label || "Select row"}
      className="h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-ink-900 cursor-pointer"
    />
  );
}
