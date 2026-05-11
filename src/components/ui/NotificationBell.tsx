// Notification bell + dropdown. Lives in the PortalShell sidebar (and
// mobile header). Polls /me/notifications on a 60s interval; dropdown
// shows last 10 with mark-read on click. "Mark all read" button.
//
// Quiet failure: if the endpoint 404s (worker not yet deployed with this
// migration applied), we just hide the bell - don't break the layout.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: number | null;
  createdAt: number;
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    try {
      const r = await api.listMyNotifications(20);
      setItems(r.items);
      setUnreadCount(r.unreadCount);
      setHidden(false);
    } catch {
      // Hide entirely on 404 / network error so a missing migration
      // never blocks the rest of the shell.
      setHidden(true);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, []);

  // Click-outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: Date.now() } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await api.markNotificationRead(id); } catch { /* refresh next tick */ }
  };
  const markAllRead = async () => {
    setItems(prev => prev.map(n => n.readAt ? n : { ...n, readAt: Date.now() }));
    setUnreadCount(0);
    try { await api.markAllNotificationsRead(); } catch { /* refresh next tick */ }
  };

  if (hidden) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100"
        title="Notifications"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-4 text-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-2xl border border-ink-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-500">
                You&rsquo;re all caught up.
              </div>
            ) : items.map((n) => {
              const inner = (
                <div className={`px-4 py-3 border-b border-ink-50 last:border-b-0 hover:bg-ink-50 ${n.readAt ? "" : "bg-ink-50/40"}`}>
                  <div className="flex items-start gap-2">
                    <div className={`h-2 w-2 mt-1.5 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-ink-900"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{n.title}</div>
                      {n.body && <div className="text-xs text-ink-600 mt-0.5 line-clamp-2">{n.body}</div>}
                      <div className="text-[10px] text-ink-400 mt-1">{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                        className="text-ink-400 hover:text-ink-900 p-1"
                        title="Mark read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
              if (n.link) {
                return (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => { if (!n.readAt) markRead(n.id); setOpen(false); }}
                    className="block"
                  >
                    {inner}
                  </Link>
                );
              }
              return <div key={n.id}>{inner}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
