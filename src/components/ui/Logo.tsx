// Logo treatment for Samwise Building Contractors Ltd.
//   Mark   = the circular construction emblem (icon-only PNG from /public)
//   Wordmark = "Samwise" in display font + "Building Contractors" subtitle
// `mark` prop renders just the badge for tight spaces (sidebar collapsed
// state, mobile, favicons, etc.).
//
// The icon is in /public so it's served at the site root. We reference it
// by URL string rather than ES-importing — Vite leaves public assets alone
// (no hashing) so the path is stable across deploys.
const ICON_URL = "/samwise-icon.png";

export function Logo({ className = "", mark = false }: { className?: string; mark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={ICON_URL}
        alt="Samwise"
        className="h-9 w-9 rounded-md object-contain shrink-0"
        loading="eager"
      />
      {!mark && (
        <span className="flex flex-col leading-tight">
          <span className="font-display font-bold tracking-tight text-ink-900 text-[18px]">
            Samwise
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
            Building Contractors
          </span>
        </span>
      )}
    </div>
  );
}
