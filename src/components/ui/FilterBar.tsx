// Generic filter bar - status pills, date range, sort, search.
//
// Built for the sub portal first (Payments, Job Cards, Contracts) so
// it's mobile-friendly out of the box: pills wrap, big tap targets,
// single-column on small screens. Each section is optional - pass
// only the props you need.
//
// State is fully controlled by the parent (no internal state) so the
// caller decides persistence (URL params, localStorage, in-memory).

import { useState, type ReactNode } from "react";
import { Calendar, Search, X, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";

export type FilterPill = { value: string; label: string; count?: number };
export type SortOption = { value: string; label: string };
export type DatePreset = "all" | "30d" | "90d" | "ytd" | "custom";

export interface FilterBarProps {
  // Status pills (optional)
  pills?: FilterPill[];
  activePill?: string;
  onPillChange?: (value: string) => void;

  // Free-text search (optional)
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;

  // Date range (optional)
  datePreset?: DatePreset;
  dateFrom?: string;
  dateTo?: string;
  onDateChange?: (preset: DatePreset, from?: string, to?: string) => void;

  // Sort (optional)
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;

  // Extra controls (optional)
  trailing?: ReactNode;
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "This year" },
  { value: "custom", label: "Custom..." },
];

export function FilterBar(props: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasAdvanced = !!(props.datePreset !== undefined || props.sortOptions);
  const activeAdvancedCount =
    (props.datePreset && props.datePreset !== "all" ? 1 : 0) +
    (props.sortValue && props.sortOptions && props.sortOptions[0]?.value !== props.sortValue ? 1 : 0);

  return (
    <div className="card-padded mb-4">
      {/* Search row + advanced toggle */}
      {(props.onSearchChange || hasAdvanced) && (
        <div className="flex gap-2 items-stretch">
          {props.onSearchChange && (
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                value={props.searchValue || ""}
                onChange={(e) => props.onSearchChange!(e.target.value)}
                placeholder={props.searchPlaceholder || "Search..."}
                className="w-full pl-9 pr-9 min-h-12 rounded-md border border-ink-200 focus:outline-none focus:border-ink-400 text-sm"
              />
              {props.searchValue && (
                <button
                  type="button"
                  onClick={() => props.onSearchChange!("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ink-100"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-ink-400" />
                </button>
              )}
            </div>
          )}
          {hasAdvanced && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`min-h-12 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-1.5 transition ${
                expanded || activeAdvancedCount > 0
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 text-ink-700 hover:bg-ink-50"
              }`}
            >
              Filters
              {activeAdvancedCount > 0 && (
                <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded-full">{activeAdvancedCount}</span>
              )}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          {props.trailing}
        </div>
      )}

      {/* Status pills */}
      {props.pills && props.pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {props.pills.map((pill) => {
            const active = pill.value === props.activePill;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => props.onPillChange?.(pill.value)}
                className={`min-h-10 px-3 rounded-full text-sm font-medium border transition inline-flex items-center gap-1.5 ${
                  active
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                }`}
              >
                {pill.label}
                {pill.count !== undefined && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-ink-100"}`}>
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Advanced filters panel */}
      {expanded && hasAdvanced && (
        <div className="mt-3 pt-3 border-t border-ink-100 space-y-3">
          {props.datePreset !== undefined && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5 inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date range
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active = preset.value === props.datePreset;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => props.onDateChange?.(preset.value)}
                      className={`min-h-10 px-3 rounded-md text-sm font-medium border ${
                        active
                          ? "bg-ink-900 text-white border-ink-900"
                          : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {props.datePreset === "custom" && (
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  <input
                    type="date"
                    value={props.dateFrom || ""}
                    onChange={(e) => props.onDateChange?.("custom", e.target.value, props.dateTo)}
                    className="min-h-12 px-3 rounded-md border border-ink-200 text-sm"
                  />
                  <input
                    type="date"
                    value={props.dateTo || ""}
                    onChange={(e) => props.onDateChange?.("custom", props.dateFrom, e.target.value)}
                    className="min-h-12 px-3 rounded-md border border-ink-200 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {props.sortOptions && props.sortOptions.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5 inline-flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" /> Sort by
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.sortOptions.map((opt) => {
                  const active = opt.value === props.sortValue;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => props.onSortChange?.(opt.value)}
                      className={`min-h-10 px-3 rounded-md text-sm font-medium border ${
                        active
                          ? "bg-ink-900 text-white border-ink-900"
                          : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper: turn a DatePreset into a [from, to] date range. Returns ISO
// YYYY-MM-DD strings or nulls when "all" is selected.
export function presetToRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): { from: string | null; to: string | null } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") return { from: customFrom || null, to: customTo || null };
  if (preset === "ytd") {
    const start = new Date(today.getUTCFullYear(), 0, 1);
    return { from: iso(start), to: iso(today) };
  }
  const days = preset === "30d" ? 30 : 90;
  const start = new Date(today);
  start.setDate(today.getDate() - days);
  return { from: iso(start), to: iso(today) };
}
