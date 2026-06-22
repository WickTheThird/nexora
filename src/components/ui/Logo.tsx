// Logo treatment for Fintrex Contractors Ltd.
//   Mark   = the circular construction emblem (icon-only PNG from /public)
//   Wordmark = "Fintrex" in display font + "Contractors" subtitle
//
// Props:
//   mark    - render just the badge (sidebar collapsed, mobile, etc.)
//   inverse - light text for use on dark backgrounds (login hero, splash)
//
// The icon lives in /public so it's served at the site root. We reference it
// by URL string rather than ES-importing - Vite leaves public assets alone
// (no hashing) so the path is stable across deploys.
// Prefix with the Vite base URL so the path resolves correctly when the app
// is mounted under a sub-path (e.g. GitHub Pages serves us from /nexora/).
// Cast via `unknown` because the project lacks /// <reference vite/client>.
const BASE = ((import.meta as unknown) as { env: { BASE_URL: string } }).env.BASE_URL;
// Loaded from /public/fintrex-icon.png. The current PNG is a
// placeholder copy of the previous brand's mark until new artwork
// lands - swap the file in place, no code change needed.
const ICON_URL = `${BASE}fintrex-icon.png`;

export function Logo({
  className = "",
  mark = false,
  inverse = false,
}: {
  className?: string;
  mark?: boolean;
  inverse?: boolean;
}) {
  // Dark text for light surfaces; light text + brighter subtitle for the
  // navy login hero panel and BootSplash.
  const titleClass = inverse ? "text-white" : "text-ink-900";
  const subtitleClass = inverse ? "text-ink-300" : "text-ink-500";
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={ICON_URL}
        alt="Fintrex Contractors"
        className="h-9 w-9 rounded-md object-contain shrink-0"
        loading="eager"
      />
      {!mark && (
        <span className="flex flex-col leading-tight">
          <span className={`font-display font-bold tracking-tight text-[18px] ${titleClass}`}>
            Fintrex
          </span>
          <span className={`text-[10px] font-medium uppercase tracking-[0.12em] ${subtitleClass}`}>
            Contractors
          </span>
        </span>
      )}
    </div>
  );
}
