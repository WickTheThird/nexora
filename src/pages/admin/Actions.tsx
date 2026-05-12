// Admin Actions hub - centralised launchpad for bulk operations.
//
// Across multiple admin pages the user kept asking 'where do bulk
// things live?'. Rather than scattering them, this page is the
// single place where every many-at-once operation starts. Each
// tile is either a route to an existing inbox/launcher, or an
// inline modal for actions that don't have their own page yet.

import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PortalShell";
import {
  Send, Mail, Users, ArrowUpRight, Inbox, Briefcase, Activity, FileText, MessagesSquare,
} from "lucide-react";

type ActionTile = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  group: "inboxes" | "bulk" | "feeds";
};

const TILES: ActionTile[] = [
  // Inboxes - existing pages with pending workload
  {
    key: "sub-requests",
    title: "Subcontractor requests inbox",
    description: "Pending principal-initiated new-sub requests + sub-initiated 'add me to your pool' applications.",
    icon: Inbox,
    to: "/admin/operative-requests",
    group: "inboxes",
  },
  {
    key: "submissions",
    title: "Job Card submissions inbox",
    description: "Pending Job Cards from principals waiting on BC processing + auto-invoice.",
    icon: Briefcase,
    to: "/admin/primary-submissions",
    group: "inboxes",
  },
  {
    key: "change-requests",
    title: "Change requests inbox",
    description: "Sub support notes + principal-side Job Card change requests. Kanban or list view.",
    icon: MessagesSquare,
    to: "/admin/change-requests",
    group: "inboxes",
  },

  // Bulk operations
  {
    key: "advice",
    title: "Issue advice (single + bulk)",
    description: "Generate payment advices for one sub or every sub with approved hours in a period.",
    icon: Send,
    to: "/admin/bulk-advice",
    group: "bulk",
  },
  {
    key: "send-template",
    title: "Contract templates",
    description: "Manage contract templates + send to subs/principals from each template's detail page.",
    icon: FileText,
    to: "/admin/templates",
    group: "bulk",
  },

  // Activity feeds
  {
    key: "recent-activity",
    title: "Recent activity feed",
    description: "Subcontractor + principal signups split by period (24h / 7d / 30d / 90d).",
    icon: Activity,
    to: "/admin/signup-requests",
    group: "feeds",
  },
  {
    key: "all-jobs",
    title: "All Jobs (cross-platform)",
    description: "Every Job Card + tender post platform-wide. Buckets, search, CSV download.",
    icon: Briefcase,
    to: "/admin/jobs",
    group: "feeds",
  },
];

const GROUP_LABELS: Record<ActionTile["group"], string> = {
  inboxes: "Inboxes - pending workload",
  bulk:    "Bulk operations",
  feeds:   "Activity feeds",
};

export function AdminActions() {
  return (
    <>
      <PageHeader title="Actions" />
      <p className="text-sm text-ink-600 mb-6 max-w-3xl">
        Centralised launchpad for everything that runs on multiple records at once. Each tile takes you straight to the dedicated page or opens an inline flow.
      </p>

      {(["inboxes", "bulk", "feeds"] as const).map(group => {
        const tiles = TILES.filter(t => t.group === group);
        if (tiles.length === 0) return null;
        return (
          <section key={group} className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-3">
              {GROUP_LABELS[group]}
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tiles.map(t => (
                <Link
                  key={t.key}
                  to={t.to}
                  className="card-padded h-full flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition group"
                >
                  <div className="h-9 w-9 rounded-md bg-ink-900 text-white grid place-items-center shrink-0">
                    <t.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-ink-900">{t.title}</h3>
                      <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-ink-700 transition" />
                    </div>
                    <p className="text-xs text-ink-500 mt-1">{t.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
