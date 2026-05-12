// Per-page contextual help. Renders a small ? button (top-right of the
// PageHeader's right slot) that opens a modal with role-aware copy
// describing what's on the page, what the cards/rows mean, and what
// the admin (or user) can do here.
//
// Content is passed as JSX children so each page owns its copy and
// can keep wording in sync with the UI without a central registry
// drift.

import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function HelpButton({
  title = "Help",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 w-9 grid place-items-center rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100 border border-ink-200 transition"
        title="Help"
        aria-label="Help on this page"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={title} width="lg">
          <div className="prose prose-ink prose-sm max-w-none">{children}</div>
        </Modal>
      )}
    </>
  );
}
