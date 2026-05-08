import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { Users, ArrowUpRight, Pencil, Save, X, UserPlus, Clock, AlertTriangle, CheckCircle2, PauseCircle, PlayCircle, Search } from "lucide-react";

type RequestRow = Awaited<ReturnType<typeof api.listMyOperativeRequests>>["items"][number];

type SubItem = Awaited<ReturnType<typeof api.listMyPrimarySubs>>["items"][number];

// Group operatives Enagh-style: Active vs Incomplete vs Closed.
//   closed_at non-null              → Closed (principal closed them)
//   onboarding_status approved/active → Active (eligible for job cards)
//   rejected                          → Closed
//   anything else                     → Incomplete
function bucket(s: SubItem): "active" | "incomplete" | "closed" {
  if (s.closedAt) return "closed";
  if (s.onboardingStatus === "rejected") return "closed";
  if (s.onboardingStatus === "approved" || s.onboardingStatus === "active") return "active";
  return "incomplete";
}

function fmtRate(minor: number | null, unit: string | null) {
  if (minor == null) return null;
  return `\u20AC${(minor / 100).toFixed(2)}/${unit || "hour"}`;
}

export function PrimarySubcontractors() {
  const toast = useToast();
  const [items, setItems] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  // Operative request form state.
  const [reqOpen, setReqOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqMobile, setReqMobile] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqNotes, setReqNotes] = useState("");
  const [reqSending, setReqSending] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [windowOpen, setWindowOpen] = useState<boolean>(true);
  const [windowText, setWindowText] = useState<string>("Friday 2:30pm – Wednesday 2pm");

  const refresh = async () => {
    try {
      const [s, r, p] = await Promise.all([
        api.listMyPrimarySubs(),
        api.listMyOperativeRequests(),
        api.getMyPrimary(),
      ]);
      setItems(s.items);
      setRequests(r.items);
      if (p.operativeRequestWindow) {
        setWindowOpen(p.operativeRequestWindow.open);
        setWindowText(p.operativeRequestWindow.humanWindow);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const submitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!reqName.trim()) { toast.error("Name required"); return; }
    setReqSending(true);
    try {
      await api.createMyOperativeRequest({
        name: reqName.trim(),
        mobile: reqMobile.trim() || undefined,
        email: reqEmail.trim() || undefined,
        notes: reqNotes.trim() || undefined,
      });
      toast.success("Request sent to BC \u2014 they'll review and add the operative");
      setReqName(""); setReqMobile(""); setReqEmail(""); setReqNotes("");
      setReqOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send request");
    } finally {
      setReqSending(false);
    }
  };

  const startEdit = (s: SubItem) => {
    setEditingRate(s.id);
    setRateInput(s.rateAmountMinor != null ? (s.rateAmountMinor / 100).toFixed(2) : "");
  };
  const saveRate = async (s: SubItem) => {
    const eur = parseFloat(rateInput);
    if (!Number.isFinite(eur) || eur < 0) { toast.error("Enter a valid rate"); return; }
    setSavingRate(true);
    try {
      await api.setMyPrincipalOperativeRate(s.id, {
        rateAmountMinor: Math.round(eur * 100),
        rateUnit: "hour",
      });
      toast.success(`Rate updated for ${s.fullName || s.subcontractorRef}`);
      setEditingRate(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setSavingRate(false);
    }
  };

  // Search + filter. Plain substring match across name, ref, email,
  // trade. Bucket filter chips let you focus on one of the three.
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | "active" | "incomplete" | "closed">("all");

  const matchesQuery = (s: SubItem) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const hay = [s.fullName, s.subcontractorRef, s.email, s.natureOfServices, s.mob, s.tel]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };

  const filteredItems = items.filter(matchesQuery);
  const grouped = {
    active: filteredItems.filter(s => bucket(s) === "active"),
    incomplete: filteredItems.filter(s => bucket(s) === "incomplete"),
    closed: filteredItems.filter(s => bucket(s) === "closed"),
  };
  // Apply bucketFilter to limit which sections render.
  const showBucket = (k: "active" | "incomplete" | "closed") =>
    bucketFilter === "all" || bucketFilter === k;

  const closeOperative = async (s: SubItem) => {
    if (!window.confirm(`Mark ${s.fullName || s.subcontractorRef || "this operative"} as no longer active under your contract?\n\nThey will be removed from your Job Card auto-list. You can reactivate them later.`)) return;
    try {
      await api.closeMyPrincipalOperative(s.id);
      toast.success(`${s.fullName || "Operative"} marked Closed`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const reactivateOperative = async (s: SubItem) => {
    if (!window.confirm(`Mark ${s.fullName || s.subcontractorRef || "this operative"} as Active again?\n\nBC will re-confirm their bank, RCT rate, and certs are still current before they appear on Job Cards.`)) return;
    try {
      await api.reactivateMyPrincipalOperative(s.id);
      toast.success(`${s.fullName || "Operative"} reactivated. BC will re-confirm details.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const renderTable = (rows: SubItem[], allowRateEdit: boolean, bucketKey: "active" | "incomplete" | "closed" = "active") => (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-ink-50 border-b border-ink-100">
          <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
            <th className="px-5 py-3">Sub ref</th>
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Trade</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">RCT</th>
            <th className="px-5 py-3">Standard rate</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
              <td className="px-5 py-3 font-mono text-xs">{s.subcontractorRef || "\u2014"}</td>
              <td className="px-5 py-3">
                <div className="font-medium text-ink-900">{s.fullName || "\u2014"}</div>
                {s.email && <div className="text-xs text-ink-500 mt-0.5">{s.email}</div>}
              </td>
              <td className="px-5 py-3 text-ink-700">{s.natureOfServices || <span className="text-ink-400">{"\u2014"}</span>}</td>
              <td className="px-5 py-3"><Badge tone="info">{s.onboardingStatus.replace(/_/g, " ")}</Badge></td>
              <td className="px-5 py-3 text-ink-700">{s.rctRate ? `${s.rctRate}%` : <span className="text-ink-400">{"\u2014"}</span>}</td>
              <td className="px-5 py-3 text-ink-700 tabular-nums">
                {allowRateEdit && editingRate === s.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-ink-500">{"\u20AC"}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums"
                      autoFocus
                    />
                    <span className="text-xs text-ink-500">/hr</span>
                    <button type="button" onClick={() => saveRate(s)} disabled={savingRate} className="text-emerald-700 hover:text-emerald-900 ml-1 p-1" title="Save"><Save className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setEditingRate(null)} className="text-ink-400 hover:text-ink-700 p-1" title="Cancel"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={s.rateAmountMinor != null ? "" : "text-ink-400"}>
                      {fmtRate(s.rateAmountMinor, s.rateUnit) ?? "\u2014"}
                    </span>
                    {allowRateEdit && (
                      <button type="button" onClick={() => startEdit(s)} className="text-ink-300 hover:text-ink-700" title="Edit rate">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                <div className="inline-flex gap-1 items-center">
                  {bucketKey === "active" && (
                    <button type="button" onClick={() => closeOperative(s)} className="text-ink-400 hover:text-amber-700 inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-amber-50" title="Mark In-Active (remove from Job Card auto-list)">
                      <PauseCircle className="h-3.5 w-3.5" /> Mark In-Active
                    </button>
                  )}
                  {bucketKey === "closed" && s.closedAt && (
                    <button type="button" onClick={() => reactivateOperative(s)} className="text-ink-400 hover:text-emerald-700 inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-emerald-50" title="Mark Active again (BC re-confirmation)">
                      <PlayCircle className="h-3.5 w-3.5" /> Mark Active
                    </button>
                  )}
                  <Link to={`/primary/subcontractors/${s.id}`} className="btn-ghost !py-1.5 inline-flex">
                    View <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Subcontractors"
        description="Workers operating under your contract via BC Construction. Click a row to see their hours and billing activity. Edit standard rate to auto-populate it on new job cards."
        right={
          <Button variant="accent" onClick={() => setReqOpen(o => !o)} leftIcon={<UserPlus className="h-4 w-4" />}>
            Request new operative
          </Button>
        }
      />

      {/* Inline request form (Enagh-style "Request New Operative") */}
      {reqOpen && (
        <form onSubmit={submitRequest} className="card-padded mb-6 bg-accent-50/40 border-accent-200">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-700 mb-3">Request a new operative</h2>
          {!windowOpen && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900">
              <strong>Heads up:</strong> outside the standard add window ({windowText}). BC can still pick up your request, but it may not be processed until the next window opens.
            </div>
          )}
          <p className="text-xs text-ink-600 mb-4">
            BC will review and add the operative once available. They&apos;ll receive an invite to onboard,
            and once active they&apos;ll appear in the Active list and on Job Card dropdowns.{" "}
            <span className="text-ink-500">Standard add window: {windowText}.</span>
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Full name" value={reqName} onChange={(e) => setReqName(e.target.value)} required autoFocus placeholder="John Doe" />
            <Input label="Mobile" value={reqMobile} onChange={(e) => setReqMobile(e.target.value)} placeholder="+353 87 ..." />
            <Input label="Email (optional)" type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="optional, helps BC invite faster" />
            <Input label="Notes (optional)" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="trade, references, anything useful" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
            <Button type="submit" variant="accent" loading={reqSending}>Send request to BC</Button>
          </div>
        </form>
      )}

      {/* Recent requests history (small banner) */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-2">Your recent requests</h2>
          <div className="card divide-y divide-ink-100">
            {requests.slice(0, 5).map((r) => {
              const tone =
                r.status === "approved" ? "success" :
                r.status === "rejected" ? "danger" :
                r.status === "cancelled" ? "neutral" : "warn";
              const Icon =
                r.status === "approved" ? CheckCircle2 :
                r.status === "rejected" ? AlertTriangle : Clock;
              return (
                <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${r.status === "approved" ? "text-emerald-700" : r.status === "rejected" ? "text-amber-700" : "text-ink-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900">{r.name}</div>
                    <div className="text-xs text-ink-500">{r.mobile || r.email || "no contact details"}</div>
                    {r.rejectionReason && (
                      <div className="text-xs text-amber-700 mt-1">Reason: {r.rejectionReason}</div>
                    )}
                  </div>
                  <Badge tone={tone}>{r.status}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Users}
          title="No subcontractors linked yet"
          description="When BC Construction assigns a subcontractor to your contract, they'll appear here."
        />
      ) : (
        <div className="space-y-6">
          {/* Search + filter chips. Excel-style: a search box and named
              "tabs" that filter the visible list. Live filter — no
              submit button, types-as-you-go. */}
          <div className="card-padded flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, sub code, email, trade…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
              {([
                ["all",        `All (${filteredItems.length})`],
                ["active",     `Active (${grouped.active.length})`],
                ["incomplete", `Incomplete (${grouped.incomplete.length})`],
                ["closed",     `Closed (${grouped.closed.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBucketFilter(key)}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    bucketFilter === key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 && query && (
            <Empty
              icon={Search}
              title="No matches"
              description={`Nothing matches "${query}". Try a shorter search, or switch the filter chip.`}
            />
          )}

          {showBucket("active") && grouped.active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
                Active <span className="text-ink-400 font-normal">({grouped.active.length})</span>
              </h2>
              {renderTable(grouped.active, true, "active")}
            </section>
          )}

          {showBucket("incomplete") && grouped.incomplete.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
                Incomplete <span className="text-ink-400 font-normal">({grouped.incomplete.length})</span>
              </h2>
              {renderTable(grouped.incomplete, false, "incomplete")}
            </section>
          )}

          {showBucket("closed") && grouped.closed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
                Closed <span className="text-ink-400 font-normal">({grouped.closed.length})</span>
              </h2>
              {renderTable(grouped.closed, false, "closed")}
            </section>
          )}
        </div>
      )}
    </>
  );
}
