import { NavLink, useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { LogOut, ChevronRight, Search, HelpCircle } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { CommandPalette, type PaletteItem } from "@/components/ui/CommandPalette";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { HelpButton } from "@/components/ui/HelpButton";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** When set, renders a muted ALL-CAPS group label above this nav
   *  item in the desktop sidebar. Lets us visually section the
   *  sidebar without inventing a separate type. */
  groupBefore?: string;
}

export function PortalShell({
  title,
  nav,
  children,
  paletteItems,
}: {
  title: string;
  nav: NavItem[];
  children: ReactNode;
  // Cmd+K command palette items (people / pages / actions) - supplied
  // per-portal via the AppShell wrapper. Optional: if absent we still
  // render a Cmd+K affordance with just the page list.
  paletteItems?: PaletteItem[];
}) {
  const { me, logout } = useAuth();
  const nav_ = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K shortcut. Excel users will recognise this from
  // VS Code, Slack, Spotlight. We deliberately match the K binding (not
  // /) so it's familiar across tools they already use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Always-available items: navigate to any nav entry. Caller can extend
  // with people / actions.
  const builtinPageItems: PaletteItem[] = nav.map(n => ({
    id: `page-${n.to}`,
    label: n.label,
    category: "pages",
    icon: n.icon,
    to: n.to,
    keywords: [title.toLowerCase()],
  }));
  const allItems: PaletteItem[] = [...(paletteItems || []), ...builtinPageItems];

  const handleLogout = async () => {
    await logout();
    nav_("/login");
  };

  return (
    <div className="min-h-full bg-ink-50">
      {/* Sidebar - fixed to the viewport so the logout button + user
          chip stay reachable regardless of how long the page is. The
          inner <nav> scrolls if the navigation list overflows; the
          footer (avatar + bell + logout) sits below the scroll area
          and stays pinned to the bottom of the viewport. */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-ink-100 bg-white z-30">
        <div className="h-16 px-5 flex items-center border-b border-ink-100">
          <Logo />
        </div>
        <div className="px-4 py-5 text-xs uppercase tracking-wider text-ink-400 font-semibold">
          {title}
        </div>
        {/* Cmd+K affordance - shows the keyboard hint and acts as a
            click target for users who don't yet know the shortcut. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-500 bg-ink-50 hover:bg-ink-100 hover:text-ink-800 transition border border-ink-100"
          title="Open command palette"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Quick search</span>
          <kbd className="font-mono text-[10px] bg-white border border-ink-200 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <div key={item.to}>
              {item.groupBefore && (
                <div className="pt-3 pb-1 px-3 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
                  {item.groupBefore}
                </div>
              )}
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-ink-900 text-white font-medium shadow-sm"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            </div>
          ))}
        </nav>
        <a
          href="#/help"
          target="_blank"
          rel="noopener"
          className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition"
          title="How Samwise works"
        >
          <HelpCircle className="h-4 w-4" />
          <span>How it works</span>
        </a>
        <div className="p-3 border-t border-ink-100">
          <div className="flex items-center gap-2 p-2">
            <div className="h-9 w-9 rounded-full bg-ink-900 text-white text-xs font-bold grid place-items-center">
              {initials(me?.email || "?")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-500">{me?.role}</div>
              <div className="text-sm text-ink-800 truncate">{me?.email}</div>
            </div>
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="p-2 text-ink-400 hover:text-ink-800 hover:bg-ink-100 rounded-md transition"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-ink-100 flex items-center justify-between px-4">
        <Logo mark />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setPaletteOpen(true)}
            className="btn-ghost !p-2"
            aria-label="Search"
            title="Quick search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="btn-ghost !p-2"
            aria-label="Menu"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-ink-950/60"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-0 right-0 bottom-0 w-72 bg-white shadow-elev p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 px-2 pt-2"><Logo /></div>
            <nav className="space-y-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                      isActive
                        ? "bg-ink-900 text-white font-medium"
                        : "text-ink-600 hover:bg-ink-100"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="btn-outline w-full mt-6"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content. Bottom padding on mobile leaves room for the
          fixed bottom-nav so content doesn't sit underneath it. */}
      <main className="min-w-0 pt-14 lg:pt-0 pb-20 lg:pb-0 lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom-nav. Phone-friendly thumb-zone for the most-used
          shortcuts. Hidden ≥lg where the sidebar takes over. We show
          AT MOST 5 items + a search button so the row stays one-handed
          reachable. */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t border-ink-100 flex items-stretch">
        {nav.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] ${
                isActive ? "text-ink-900 font-semibold" : "text-ink-500"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] text-ink-500"
          title="Search (⌘K)"
        >
          <Search className="h-5 w-5" />
          <span>Search</span>
        </button>
      </nav>

      {/* Global Cmd+K command palette */}
      <CommandPalette items={allItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  right,
  help,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  /** Optional contextual help. If provided, a ? button is rendered in
   *  the right slot (before any other actions); clicking opens a modal
   *  with this content. Per-page copy describing what cards/rows mean
   *  and what the admin (or user) can do here. */
  help?: ReactNode;
}) {
  // Mobile: stack vertically with the action buttons full-width below
  // the heading. Desktop: keep title left, actions right.
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-ink-900">
          {title}
        </h1>
        {description && (
          <p className="text-sm sm:text-base text-ink-500 mt-1 sm:mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {(right || help) && (
        <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
          {help && <HelpButton title={`${title} · Help`}>{help}</HelpButton>}
          {right}
        </div>
      )}
    </div>
  );
}
