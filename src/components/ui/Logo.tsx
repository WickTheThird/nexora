import { brandName } from "@/lib/api";

export function Logo({ className = "", mark = false }: { className?: string; mark?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-8 w-8 rounded-lg bg-ink-900 text-white grid place-items-center shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18 L4 6 L20 18 L20 6" />
        </svg>
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
      </div>
      {!mark && (
        <span className="font-display font-bold tracking-tight text-ink-900 text-[17px]">
          {brandName()}
        </span>
      )}
    </div>
  );
}
