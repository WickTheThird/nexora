// Mobile bottom navigation - 5 tabs anchored to the bottom of the
// viewport on screens < lg. Designed for thumb-friendly use on phones:
// each tab is min-h-14 with a 22px icon + tiny label.
//
// Hidden on lg+ (the side rail in PortalShell takes over there).
//
// Renders a badge on a tab when `badge > 0` (e.g. pending Job Cards).

import { NavLink } from "react-router-dom";
import type { ComponentType, ReactNode } from "react";

export type BottomTab = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
};

export function BottomNav({
  tabs,
  trailing,
}: {
  tabs: BottomTab[];
  /** Optional content right of the tabs (e.g. a FAB in front). */
  trailing?: ReactNode;
}) {
  return (
    <>
      {/* Spacer pushes page content above the fixed bar so it isn't
          hidden under it. Equal to the bar height + safe-area inset. */}
      <div className="lg:hidden h-20" aria-hidden />
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-ink-200 flex items-stretch shadow-elev"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium relative ${
                  isActive ? "text-ink-900" : "text-ink-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-80"}`} />
                    {!!t.badge && t.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold grid place-items-center">
                        {t.badge > 99 ? "99+" : t.badge}
                      </span>
                    )}
                  </div>
                  <span className="leading-none">{t.label}</span>
                  {isActive && <div className="absolute top-0 inset-x-3 h-0.5 bg-ink-900 rounded-b" />}
                </>
              )}
            </NavLink>
          );
        })}
        {trailing}
      </nav>
    </>
  );
}
