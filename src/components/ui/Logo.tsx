import { brandName } from "@/lib/api";

// Logo treatment:
//   Mark   = "SW" monogram in a navy rounded square with a small accent dot.
//   Wordmark = the brand name + a subtle "·bc" subscript (the team).
// To switch to "^bc" or ".bc", change the SUBSCRIPT constant below.
const SUBSCRIPT = "·bc";

export function Logo({ className = "", mark = false }: { className?: string; mark?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-8 w-8 rounded-lg bg-ink-900 text-white grid place-items-center shadow-sm">
        <span className="text-[11px] font-display font-bold tracking-tight leading-none">SW</span>
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
      </div>
      {!mark && (
        <span className="flex items-baseline gap-1">
          <span className="font-display font-bold tracking-tight text-ink-900 text-[17px]">
            {brandName().toLowerCase()}
          </span>
          <span className="text-[11px] font-medium text-ink-400 tracking-wider">{SUBSCRIPT}</span>
        </span>
      )}
    </div>
  );
}
