// Per-page contextual help. Renders a small ? button (top-right of the
// PageHeader's right slot) that opens a modal with role-aware copy
// describing what's on the page, what the cards/rows mean, and what
// the admin (or user) can do here.
//
// Content is passed as JSX children so each page owns its copy and
// can keep wording in sync with the UI without a central registry
// drift. The wrapper applies compact typography so help guides stay
// readable - small caps section labels, tight spacing, mid-grey body.

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
        <Modal open onClose={() => setOpen(false)} title={title} width="md">
          {/* Compact help styling - smaller font, tight spacing, small-caps
              section labels for h3. Lists hug close together; strong / code
              styled inline. Width is "md" (max-w-md ~28rem) so each line
              stays in the comfortable reading zone (60-70 chars). */}
          <div
            className={[
              "text-[13px] leading-relaxed text-ink-700",
              // h3 -> small caps section dividers
              "[&_h3]:text-[10.5px] [&_h3]:uppercase [&_h3]:tracking-wider",
              "[&_h3]:font-semibold [&_h3]:text-ink-900",
              "[&_h3]:mt-4 [&_h3:first-child]:mt-0 [&_h3]:mb-1.5",
              "[&_h3]:pb-1 [&_h3]:border-b [&_h3]:border-ink-100",
              // paragraphs
              "[&_p]:mb-2 [&_p:last-child]:mb-0",
              // lists
              "[&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:space-y-0.5",
              "[&_ol]:mb-2 [&_ol]:pl-4 [&_ol]:list-decimal [&_ol]:space-y-0.5",
              "[&_li]:pl-0.5 [&_li]:marker:text-ink-400",
              // inline emphasis
              "[&_strong]:text-ink-900 [&_strong]:font-semibold",
              "[&_em]:text-ink-700 [&_em]:italic",
              // code chips
              "[&_code]:bg-ink-100 [&_code]:text-ink-800 [&_code]:px-1 [&_code]:py-0.5",
              "[&_code]:rounded [&_code]:text-[11.5px] [&_code]:font-mono",
            ].join(" ")}
          >
            {children}
          </div>
        </Modal>
      )}
    </>
  );
}
