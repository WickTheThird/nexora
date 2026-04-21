import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { DocumentRecord, DocumentType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import {
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Download,
  FileText,
  IdCard,
  ShieldCheck,
  FilePlus,
} from "lucide-react";

const docTypes: { value: DocumentType; label: string; icon: React.ComponentType<{ className?: string }>; hint: string; required?: boolean }[] = [
  { value: "photo_id", label: "Photographic ID", icon: IdCard, hint: "Passport or driving licence", required: true },
  { value: "hs_card",  label: "H&S card",        icon: ShieldCheck, hint: "Current safety card", required: true },
  { value: "insurance",label: "Insurance",       icon: FileText, hint: "Public liability etc." },
  { value: "cert",     label: "Certifications",  icon: FileText, hint: "Trade certifications" },
  { value: "other",    label: "Other",           icon: FileText, hint: "Anything else relevant" },
];

function reviewBadge(s: DocumentRecord["reviewStatus"]) {
  if (s === "approved")  return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3"/>}>Approved</Badge>;
  if (s === "rejected")  return <Badge tone="danger" icon={<XCircle className="h-3 w-3"/>}>Rejected</Badge>;
  return <Badge tone="warn" icon={<Clock className="h-3 w-3"/>}>Pending review</Badge>;
}

export function Documents() {
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = async () => {
    const { items } = await api.listMyDocuments();
    setDocs(items);
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
  }, []);

  const upload = async (type: DocumentType, file: File) => {
    setUploading(type);
    try {
      await api.uploadMyDocument(type, file);
      await refresh();
      toast.success(`${file.name} uploaded`);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.code === "UPLOAD_TOO_LARGE"
            ? "File is larger than 10MB."
            : e.code === "UNSUPPORTED_MEDIA_TYPE"
            ? "Only PDF / JPG / PNG / HEIC allowed."
            : e.message
          : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  const deleteDoc = async (d: DocumentRecord) => {
    if (!confirm("Delete this document?")) return;
    try {
      await api.deleteMyDocument(d.id);
      await refresh();
      toast.info("Document deleted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to delete");
    }
  };

  const download = (d: DocumentRecord) => {
    // Opens in new tab. Browser sends credentials for same-site; cross-site needs CORS + credentials include.
    const link = document.createElement("a");
    link.href = api.downloadMyDocumentUrl(d.id);
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const byType = (t: DocumentType) =>
    docs
      .filter((d) => d.documentType === t)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload your compliance documents. Admins will review each one."
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <div className="space-y-5">
          {docTypes.map((dt) => {
            const mine = byType(dt.value);
            const latest = mine[0];
            return (
              <div key={dt.value} className="card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center flex-shrink-0">
                      <dt.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink-900">{dt.label}</h3>
                        {dt.required && <Badge tone="neutral">Required</Badge>}
                        {latest && reviewBadge(latest.reviewStatus)}
                      </div>
                      <p className="text-sm text-ink-500 mt-0.5">{dt.hint}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      ref={(el) => (fileRefs.current[dt.value] = el)}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(dt.value, f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      leftIcon={latest ? <FilePlus className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      loading={uploading === dt.value}
                      onClick={() => fileRefs.current[dt.value]?.click()}
                    >
                      {latest ? "Upload new" : "Upload"}
                    </Button>
                  </div>
                </div>
                {mine.length > 0 && (
                  <div className="mt-5 border-t border-ink-100 pt-4 space-y-2">
                    {mine.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-ink-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink-800 truncate">
                            {d.originalFilename}
                          </div>
                          <div className="text-xs text-ink-500">
                            {fmtBytes(d.sizeBytes)} · {fmtDateTime(d.uploadedAt)}
                          </div>
                          {d.reviewNote && (
                            <div className={`text-xs mt-1 ${d.reviewStatus === "rejected" ? "text-red-700" : "text-ink-600"}`}>
                              Admin note: {d.reviewNote}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {reviewBadge(d.reviewStatus)}
                          <Button variant="ghost" size="sm" onClick={() => download(d)} leftIcon={<Download className="h-4 w-4"/>}>
                            View
                          </Button>
                          {d.reviewStatus === "pending" && (
                            <Button variant="ghost" size="sm" onClick={() => deleteDoc(d)} leftIcon={<Trash2 className="h-4 w-4"/>}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-ink-400">
        Max 10MB per file. Allowed formats: PDF, JPG, PNG, HEIC/HEIF.
      </p>
    </>
  );
}
