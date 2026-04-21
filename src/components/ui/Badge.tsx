import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "warn" | "success" | "danger";

export function Badge({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const cls = {
    neutral: "badge-neutral",
    info: "badge-info",
    warn: "badge-warn",
    success: "badge-success",
    danger: "badge-danger",
  }[tone];
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}
