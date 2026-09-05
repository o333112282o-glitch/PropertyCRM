import { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, X, Clock, UserPlus, AlertTriangle, Check, BellOff } from 'lucide-react';
import { useNotifications, AppNotification } from '@/lib/useNotifications';
import { timeAgo } from '@/lib/utils';

const NOTIF_ICONS: Record<AppNotification['type'], { icon: typeof Clock; color: string; bg: string }> = {
  follow_up: { icon: Clock, color: 'text-[#F97316]', bg: 'bg-[#F97316]/10' },
  lead_assigned: { icon: UserPlus, color: 'text-sky-600', bg: 'bg-sky-50' },
  overdue: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
};

export default function NotificationCenter() {
  const { notifications, unreadCount, permission, requestPermission, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const BellIcon = unreadCount > 0 ? BellRing : Bell;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl hover:bg-white/10 transition text-white/80 hover:text-white"
        title="Notifications"
      >
        <BellIcon size={20} className={unreadCount > 0 ? 'animate-[wiggle_.5s_ease-in-out]' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#F97316] text-white text-[10px] font-bold border-2 border-[#1E293B]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 animate-[fadeIn_.15s_ease-out] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-[#F97316] px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[#F97316] font-semibold hover:underline flex items-center gap-1"
                >
                  <Check size={12} />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Permission banner */}
          {permission !== 'granted' && 'Notification' in window && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <div className="flex items-start gap-2">
                <BellOff size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-amber-800 font-medium">Enable push notifications</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Get alerts for follow-ups and new leads</p>
                </div>
                <button
                  onClick={requestPermission}
                  className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition"
                >
                  Enable
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No notifications</p>
                <p className="text-xs text-gray-300 mt-0.5">You're all caught up</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => {
                  const config = NOTIF_ICONS[notif.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition ${
                        !notif.read ? 'bg-[#F97316]/[0.03]' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(new Date(notif.createdAt).toISOString())}</p>
                      </div>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%,100% { transform: rotate(0deg) }
          25% { transform: rotate(-8deg) }
          75% { transform: rotate(8deg) }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
