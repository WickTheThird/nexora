import { NavLink, useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { LogOut, ChevronRight } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

export function PortalShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const { me, logout } = useAuth();
  const nav_ = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    nav_("/login");
  };

  return (
    <div className="min-h-full flex bg-ink-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-ink-100 bg-white">
        <div className="h-16 px-5 flex items-center border-b border-ink-100">
          <Logo />
        </div>
        <div className="px-4 py-5 text-xs uppercase tracking-wider text-ink-400 font-semibold">
          {title}
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
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
          ))}
        </nav>
        <div className="p-3 border-t border-ink-100">
          <div className="flex items-center gap-3 p-2">
            <div className="h-9 w-9 rounded-full bg-ink-900 text-white text-xs font-bold grid place-items-center">
              {initials(me?.email || "?")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-500">{me?.role}</div>
              <div className="text-sm text-ink-800 truncate">{me?.email}</div>
            </div>
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
        <Logo />
        <button
          onClick={() => setMenuOpen(true)}
          className="btn-ghost !p-2"
          aria-label="Menu"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
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

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink-900">
          {title}
        </h1>
        {description && (
          <p className="text-ink-500 mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {right && <div className="flex-shrink-0 flex gap-2">{right}</div>}
    </div>
  );
}
