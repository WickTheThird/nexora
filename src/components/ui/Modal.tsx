import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

const widthClass: Record<NonNullable<Props["width"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`card w-full ${widthClass[width]} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="p-6 pb-4 border-b border-ink-100 flex items-start justify-between gap-4">
            <div>
              {title && <h2 className="text-lg font-semibold text-ink-900">{title}</h2>}
              {description && (
                <p className="text-sm text-ink-500 mt-1">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-700 rounded-md p-1 hover:bg-ink-100 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="p-4 border-t border-ink-100 bg-ink-50/50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
      <button
        className="absolute inset-0 -z-10 cursor-default"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
