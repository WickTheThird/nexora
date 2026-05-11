// Cmd+K / Ctrl+K command palette. Excel-style mental model: one keystroke
// gets you to anything (a person, a page, an action). Used everywhere in
// this product - principal, admin, sub side.
//
// Design goals:
//   - Zero learning curve for Excel-fluent users
//   - Fuzzy-substring filter, not full-text - types you saw it spelled
//   - Keyboard-first (Cmd/Ctrl+K to open, ↑↓ to navigate, Enter to pick,
//     Esc to close)
//   - Result categories: People · Pages · Actions
//   - Doesn't require a server query for the page/action lists; people
//     are loaded lazily via a callback the caller provides
//
// Mounted once at the App level (inside AuthProvider) so every authed
// page has it. The backing data (people, pages, actions) is built per-
// role in the providing AppShell.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, User, FileText, ClipboardList, MapPin, Settings as SettingsIcon, Wallet, Building2, Inbox, X, CornerDownLeft } from "lucide-react";

export type PaletteItem = {
  id: string;
  label: string;
  hint?: string;     // secondary line (email, sub-ref, etc.)
  category: "people" | "pages" | "actions";
  icon?: React.ComponentType<{ className?: string }>;
  // Either navigate to a route OR call a function (for actions like "Mark
  // active") - caller chooses.
  to?: string;
  onSelect?: () => void | Promise<void>;
  // Optional keywords to widen the fuzzy match (e.g. include nickname,
  // email local part, postcode for sites).
  keywords?: string[];
};

interface Props {
  items: PaletteItem[];
  /** When true, the palette is visible. Setting false closes it. */
  open: boolean;
  onClose: () => void;
}

// Category icons - fall back to a category-default if the item didn't
// supply one.
function defaultIcon(cat: PaletteItem["category"]): React.ComponentType<{ className?: string }> {
  if (cat === "people") return User;
  if (cat === "pages")  return ArrowRight;
  return FileText;
}

// Substring-match score. Lower is better. Prefix match beats interior;
// shorter haystack beats longer (so "Filip" outranks "Some Long Filip
// Bumbu Test"). Items with no haystack hit are excluded entirely.
function score(haystack: string, needle: string): number | null {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const idx = h.indexOf(n);
  if (idx < 0) return null;
  // Boost prefix matches, then start-of-word matches, then everything else.
  let s = idx;
  if (idx === 0) s -= 1000;
  else if (h[idx - 1] === " ") s -= 500;
  return s + h.length * 0.01; // tie-break by length
}

function bestScore(item: PaletteItem, q: string): number | null {
  const candidates = [item.label, item.hint || "", ...(item.keywords || [])];
  let best: number | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const s = score(c, q);
    if (s != null && (best == null || s < best)) best = s;
  }
  return best;
}

export function CommandPalette({ items, open, onClose }: Props) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset query + selection when palette opens. Focus the input so the
  // user can start typing immediately.
  useEffect(() => {
    if (open) {
      setQ("");
      setActiveIdx(0);
      // Small RAF defer so the input is mounted when we focus.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Filter + group + sort. Two orderings come out of this:
  //   - per-category items are sorted by match score (best first)
  //   - the flat array used for keyboard nav follows RENDER ORDER
  //     (People -> Pages -> Actions) so ArrowDown/Up traverses every
  //     visible row in the order the user sees them. Previously we used
  //     score order for nav which made the index disagree with render
  //     order and made arrow keys appear to skip the Pages section.
  const grouped = useMemo(() => {
    const scored: Array<{ item: PaletteItem; s: number }> = [];
    for (const it of items) {
      const s = q ? bestScore(it, q) : 0;
      if (s == null) continue;
      scored.push({ item: it, s });
    }
    scored.sort((a, b) => a.s - b.s);
    // Cap to 50 - nobody is going to scroll past that.
    const scoredCapped = scored.slice(0, 50).map(x => x.item);
    const order: PaletteItem["category"][] = ["people", "pages", "actions"];
    const out: Array<{ category: PaletteItem["category"]; items: PaletteItem[] }> = [];
    const renderOrder: PaletteItem[] = [];
    for (const cat of order) {
      const subset = scoredCapped.filter(i => i.category === cat);
      if (subset.length) {
        out.push({ category: cat, items: subset });
        renderOrder.push(...subset);
      }
    }
    return { grouped: out, flatAllInOrder: renderOrder };
  }, [items, q]);

  const flat = grouped.flatAllInOrder;

  // Clamp active index when results change.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(0);
  }, [flat.length, activeIdx]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const pick = (it: PaletteItem) => {
    onClose();
    if (it.to) nav(it.to);
    if (it.onSelect) it.onSelect();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-100">
          <Search className="h-5 w-5 text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(flat.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); const it = flat[activeIdx]; if (it) pick(it); }
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            placeholder="Search people, pages, or actions…"
            className="flex-1 outline-none text-base placeholder:text-ink-400"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" onClick={onClose} title="Close (Esc)" className="text-ink-400 hover:text-ink-700 p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-500">
              No matches for &ldquo;{q}&rdquo;.
            </div>
          ) : grouped.grouped.map((group) => (
            <div key={group.category} className="mb-2 last:mb-0">
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
                {group.category === "people" ? "People" : group.category === "pages" ? "Pages" : "Actions"}
              </div>
              {group.items.map((it) => {
                const idx = flat.indexOf(it);
                const Icon = it.icon || defaultIcon(it.category);
                const active = idx === activeIdx;
                return (
                  <button
                    key={it.id}
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => pick(it)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 ${active ? "bg-ink-900 text-white" : "hover:bg-ink-50 text-ink-800"}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white/80" : "text-ink-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.label}</div>
                      {it.hint && (
                        <div className={`truncate text-xs ${active ? "text-white/70" : "text-ink-500"}`}>
                          {it.hint}
                        </div>
                      )}
                    </div>
                    {active && <CornerDownLeft className="h-3.5 w-3.5 text-white/70 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-ink-100 text-[11px] text-ink-500 flex items-center gap-3">
          <span><kbd className="font-mono bg-ink-100 px-1.5 py-0.5 rounded">↑</kbd>{" "}<kbd className="font-mono bg-ink-100 px-1.5 py-0.5 rounded">↓</kbd> Navigate</span>
          <span><kbd className="font-mono bg-ink-100 px-1.5 py-0.5 rounded">Enter</kbd> Open</span>
          <span><kbd className="font-mono bg-ink-100 px-1.5 py-0.5 rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

// Convenience icon presets used by callers when building items.
export const PaletteIcons = {
  user: User,
  page: ArrowRight,
  jobCard: ClipboardList,
  invoice: FileText,
  site: MapPin,
  settings: SettingsIcon,
  wallet: Wallet,
  building: Building2,
  inbox: Inbox,
};
