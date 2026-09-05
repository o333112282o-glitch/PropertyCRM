import { useState, useMemo } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Clock,
  UserPlus,
  AlertTriangle,
  Check,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { useNotifications, AppNotification } from '@/lib/useNotifications';
import { timeAgo } from '@/lib/utils';

const NOTIF_ICONS: Record<AppNotification['type'], { icon: typeof Clock; color: string; bg: string }> = {
  follow_up: { icon: Clock, color: 'text-[#F97316]', bg: 'bg-[#F97316]/10' },
  lead_assigned: { icon: UserPlus, color: 'text-sky-600', bg: 'bg-sky-50' },
  overdue: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
};

type FilterType = 'all' | AppNotification['type'];

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  follow_up: 'Follow-ups',
  lead_assigned: 'New Leads',
  overdue: 'Overdue',
};

export default function NotificationsPage() {
  const { notifications, unreadCount, permission, requestPermission, markAllRead, refresh } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const counts = useMemo(() => ({
    all: notifications.length,
    follow_up: notifications.filter((n) => n.type === 'follow_up').length,
    lead_assigned: notifications.filter((n) => n.type === 'lead_assigned').length,
    overdue: notifications.filter((n) => n.type === 'overdue').length,
  }), [notifications]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You\'re all caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition"
            >
              <CheckCheck size={16} />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <BellRing size={16} />
          </button>
        </div>
      </div>

      {/* Permission banner */}
      {permission !== 'granted' && 'Notification' in window && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <BellOff size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Push notifications are off</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Enable browser notifications to get alerts for follow-ups, new leads, and overdue tasks
            </p>
          </div>
          <button
            onClick={requestPermission}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition flex-shrink-0"
          >
            Enable
          </button>
        </div>
      )}

      {permission === 'granted' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <Check size={16} className="text-emerald-600" />
          <p className="text-xs text-emerald-700 font-medium">Push notifications are enabled</p>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={16} className="text-gray-400 flex-shrink-0" />
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
              filter === key
                ? 'bg-[#1E293B] text-white border-[#1E293B]'
                : 'bg-white text-gray-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {FILTER_LABELS[key]}
            {counts[key] > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold ${filter === key ? 'text-white/70' : 'text-gray-400'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No notifications</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === 'all' ? 'You\'ll see follow-up reminders and lead alerts here' : `No ${FILTER_LABELS[filter].toLowerCase()} notifications`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((notif) => {
              const config = NOTIF_ICONS[notif.type];
              const Icon = config.icon;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-4 hover:bg-slate-50 transition ${
                    !notif.read ? 'bg-[#F97316]/[0.03]' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{notif.body}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{timeAgo(new Date(notif.createdAt).toISOString())}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
