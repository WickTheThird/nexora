import { PageHeader } from "@/components/layout/PortalShell";

// Monthly Certificates / Statements page.
//
// Empty state for now: BC's accountants haven't generated any monthly
// RCT certificates yet, and we don't have a backend feed for them.
// The page exists so the navigation matches Enagh and so the route is
// reachable; the populated state will be added when the user provides
// the data spec.

export function Statements() {
  return (
    <>
      <PageHeader title="Statements" />
      <div className="card-padded bg-sky-50/60 border border-sky-100">
        <p className="text-sm text-sky-900">
          There are no Statements available for ROI accounts at this time.
        </p>
      </div>
    </>
  );
}
