import type { ReactNode, ComponentType } from "react";

export function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      {Icon && (
        <div className="mx-auto h-12 w-12 rounded-full bg-ink-100 grid place-items-center mb-4">
          <Icon className="h-6 w-6 text-ink-500" />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-ink-500 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="card p-6 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-5/6" />
    </div>
  );
}
