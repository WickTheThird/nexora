// EN / RO flag toggle. Two big buttons side-by-side so the
// affordance is obvious without reading any label. The active
// language has a dark background + white text; the inactive one is
// pale grey. One click = switch.
//
// Persistence:
//   - Always writes to localStorage via setLocale() so the next page
//     visit (logged out or not) remembers.
//   - If a user is signed in, fires-and-forgets PATCH /me/preferences
//     so the server-side preferred_locale stays in sync (email +
//     push templates honour that column).
//
// Placement: header on every sub-portal page + every public page.
// NOT shown for principal/admin yet - they stay English-only for
// now (per user instruction 2026-05-18).

import { useTranslation } from "react-i18next";
import { setLocale, type SupportedLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Size = "sm" | "md";

interface FlagButtonProps {
  locale: SupportedLocale;
  flag: string;
  label: string;
  active: boolean;
  size: Size;
  onClick: () => void;
}

function FlagButton({ locale, flag, label, active, size, onClick }: FlagButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium border transition select-none";
  // sm = compact (sidebar footer, public page corner). md = touch-
  // friendly (mobile inline). We always show flag + locale label so
  // people who can't read the language still find their flag.
  const sizes = size === "sm"
    ? "px-2.5 py-1 text-[11px] min-w-[52px]"
    : "px-3 py-2 text-sm min-h-[44px] min-w-[68px]";
  const tone = active
    ? "bg-ink-900 text-white border-ink-900 shadow-sm"
    : "bg-white text-ink-500 border-ink-200 hover:border-ink-400 hover:text-ink-800";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} (${locale.toUpperCase()})`}
      className={`${base} ${sizes} ${tone}`}
    >
      <span className="text-sm leading-none" aria-hidden>{flag}</span>
      <span className="font-semibold tracking-wider uppercase">{locale}</span>
    </button>
  );
}

interface LocaleSwitcherProps {
  /** "sm" for tight headers, "md" (default) for touch-friendly placements. */
  size?: Size;
  /** Optional className passthrough on the wrapper. */
  className?: string;
}

export function LocaleSwitcher({ size = "sm", className = "" }: LocaleSwitcherProps) {
  const { i18n, t } = useTranslation();
  const { me } = useAuth();
  const current = (i18n.language?.slice(0, 2) || "en") as SupportedLocale;

  const change = (locale: SupportedLocale) => {
    if (locale === current) return;
    setLocale(locale);
    // Fire-and-forget server sync. We don't await: the UI already
    // re-rendered and the next email pulls preferred_locale.
    if (me) {
      api.patchMyPreferences({ locale }).catch(() => {
        /* non-fatal: localStorage is the source of truth on the
           client; the worker just mirrors for email/push templates. */
      });
    }
  };

  return (
    <div
      role="group"
      aria-label={t("locale.switchLanguage")}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <FlagButton
        locale="en"
        flag="🇬🇧"
        label={t("locale.english")}
        active={current === "en"}
        size={size}
        onClick={() => change("en")}
      />
      <FlagButton
        locale="ro"
        flag="🇷🇴"
        label={t("locale.romanian")}
        active={current === "ro"}
        size={size}
        onClick={() => change("ro")}
      />
    </div>
  );
}
