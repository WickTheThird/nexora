// Multi-row selection hook. Excel-style:
//   - Row checkbox toggles single row
//   - Header checkbox toggles all visible rows
//   - Shift+click on a row checkbox selects the range from the last
//     clicked row to the current one (the canonical Excel/Gmail/Linear
//     pattern people already know)
//   - Cmd/Ctrl+A would select all but we don't bind that globally - too
//     intrusive in input-heavy admin pages.
//
// Returns:
//   selected      - Set<string> of selected row IDs
//   isSelected(id)
//   toggle(id, opts?) - opts.shift triggers range from anchor to id
//   toggleAll(allIds)
//   clear()
//   count

import { useCallback, useMemo, useRef, useState } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Anchor for range-select. Updated whenever the user toggles without
  // shift; shift+click reads this to compute the range.
  const anchorRef = useRef<string | null>(null);
  // Snapshot of the visible row order. Range-select needs this; the
  // caller updates it via setOrder(allIds) on every render.
  const orderRef = useRef<string[]>([]);

  const setOrder = useCallback((ids: string[]) => {
    orderRef.current = ids;
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string, opts?: { shift?: boolean }) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (opts?.shift && anchorRef.current && anchorRef.current !== id) {
        const order = orderRef.current;
        const a = order.indexOf(anchorRef.current);
        const b = order.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          // Match the new endpoint's selection state to the anchor's.
          const turnOn = next.has(anchorRef.current);
          for (let i = lo; i <= hi; i++) {
            if (turnOn) next.add(order[i]);
            else next.delete(order[i]);
          }
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchorRef.current = id;
      return next;
    });
  }, []);

  const toggleAll = useCallback((allIds: string[]) => {
    setSelected(prev => {
      // If everything visible is already selected, deselect all visible.
      // Otherwise select everything visible (additive).
      const allInPrev = allIds.every(id => prev.has(id));
      if (allInPrev) {
        const next = new Set(prev);
        for (const id of allIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allIds) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  return useMemo(() => ({
    selected,
    selectedIds: Array.from(selected),
    isSelected,
    toggle,
    toggleAll,
    clear,
    setOrder,
    count: selected.size,
  }), [selected, isSelected, toggle, toggleAll, clear, setOrder]);
}
