import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import {
  User,
  SessionLog,
  ActivityLog,
  getPresence,
  PRESENCE_COLORS,
  PRESENCE_LABELS,
} from '@/lib/types';
import { formatDateTime, formatDate, timeAgo } from '@/lib/utils';
import {
  Clock,
  Phone,
  MessageCircle,
  Edit3,
  LogIn,
  LogOut,
  Calendar,
  Users,
  ClipboardList,
  Activity,
  TrendingUp,
} from 'lucide-react';

type Tab = 'presence' | 'sessions' | 'activity';

export default function ActivityLogsPage() {
  const { isManager } = useAuth();
  const getVisibleAgentIds = useVisibleAgentIds();
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('presence');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().slice(0, 10));
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    let visibleIds: string[] | null = null;
    if (isManager && getVisibleAgentIds) {
      visibleIds = await getVisibleAgentIds();
    }

    let userQuery = supabase.from('users').select('*').order('created_at', { ascending: true });
    if (visibleIds) userQuery = userQuery.in('id', visibleIds);
    const { data: userData } = await userQuery;
    const allUsers = (userData as User[]) || [];
    setUsers(allUsers);

    const dayStart = new Date(dateFilter + 'T00:00:00');
    const dayEnd = new Date(dateFilter + 'T23:59:59');

    let sessionQuery = supabase
      .from('session_logs')
      .select('*')
      .gte('login_at', dayStart.toISOString())
      .lte('login_at', dayEnd.toISOString());
    if (visibleIds) sessionQuery = sessionQuery.in('user_id', visibleIds);
    const { data: sessionData } = await sessionQuery.order('login_at', { ascending: false });
    setSessions((sessionData as SessionLog[]) || []);

    let actQuery = supabase
      .from('activity_logs')
      .select('*')
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());
    if (visibleIds) actQuery = actQuery.in('user_id', visibleIds);
    const { data: actData } = await actQuery.order('created_at', { ascending: false });
    setActivityLogs((actData as ActivityLog[]) || []);

    setLoading(false);
  }, [dateFilter, isManager, getVisibleAgentIds]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const teamMembers = useMemo(
    () => users.filter((u) => u.role === 'agent' || u.role === 'manager'),
    [users]
  );

  const onlineCount = useMemo(
    () => teamMembers.filter((u) => getPresence(u.last_active_at) === 'online').length,
    [teamMembers]
  );
  const idleCount = useMemo(
    () => teamMembers.filter((u) => getPresence(u.last_active_at) === 'idle').length,
    [teamMembers]
  );

  const filteredSessions = useMemo(() => {
    if (agentFilter === 'all') return sessions;
    return sessions.filter((s) => s.user_id === agentFilter);
  }, [sessions, agentFilter]);

  const filteredActivity = useMemo(() => {
    if (agentFilter === 'all') return activityLogs;
    return activityLogs.filter((a) => a.user_id === agentFilter);
  }, [activityLogs, agentFilter]);

  const userName = (id: string | null) => {
    if (!id) return 'System';
    const u = users.find((u) => u.id === id);
    return u?.full_name || u?.username || 'Unknown';
  };

  // Aggregate per-agent stats for the day
  const agentStats = useMemo(() => {
    return teamMembers.map((member) => {
      const memberSessions = sessions.filter((s) => s.user_id === member.id);
      const firstLogin = memberSessions.length > 0
        ? memberSessions.sort((a, b) => new Date(a.login_at).getTime() - new Date(b.login_at).getTime())[0].login_at
        : null;
      const lastLogout = memberSessions
        .filter((s) => s.logout_at)
        .sort((a, b) => new Date(b.logout_at!).getTime() - new Date(a.logout_at!).getTime())[0]?.logout_at || null;

      let totalMs = 0;
      for (const s of memberSessions) {
        const start = new Date(s.login_at).getTime();
        const end = s.logout_at ? new Date(s.logout_at).getTime() : Date.now();
        totalMs += end - start;
      }
      const hours = Math.floor(totalMs / 3600000);
      const mins = Math.floor((totalMs % 3600000) / 60000);
      const activeHours = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      const memberActivity = activityLogs.filter((a) => a.user_id === member.id);
      const callsLogged = memberActivity.filter((a) => a.action.toLowerCase().includes('call')).length;
      const whatsappLogged = memberActivity.filter((a) => a.action.toLowerCase().includes('whatsapp')).length;
      const leadsUpdated = memberActivity.filter((a) =>
        a.action.toLowerCase().includes('updated') ||
        a.action.toLowerCase().includes('quick edit') ||
        a.action.toLowerCase().includes('reassign')
      ).length;

      const presence = getPresence(member.last_active_at);

      return {
        member,
        presence,
        firstLogin,
        lastLogout,
        activeHours,
        callsLogged,
        whatsappLogged,
        leadsUpdated,
        totalActions: memberActivity.length,
      };
    });
  }, [teamMembers, sessions, activityLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          <span className="text-emerald-600 font-medium">{onlineCount} online</span>
          {' · '}
          <span className="text-amber-600 font-medium">{idleCount} idle</span>
          {' · '}
          <span className="text-slate-500 font-medium">{teamMembers.length - onlineCount - idleCount} offline</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <TabButton tab={tab} value="presence" onClick={setTab} icon={Users} label="Live Status" />
        <TabButton tab={tab} value="sessions" onClick={setTab} icon={Clock} label="Sessions" />
        <TabButton tab={tab} value="activity" onClick={setTab} icon={Activity} label="Audit Trail" />
      </div>

      {/* Date + Agent filter (for sessions & audit tabs) */}
      {tab !== 'presence' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setLoading(true); }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-gray-900 text-sm font-medium focus:border-[#D4AF37] outline-none transition"
            />
          </div>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-gray-900 text-sm font-medium focus:border-[#D4AF37] outline-none transition"
          >
            <option value="all">All Members</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name || m.username}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Live Status Tab ── */}
      {tab === 'presence' && (
        <div className="space-y-3">
          {/* Presence summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <PresenceCard label="Online" count={onlineCount} color="emerald" />
            <PresenceCard label="Idle" count={idleCount} color="amber" />
            <PresenceCard label="Offline" count={teamMembers.length - onlineCount - idleCount} color="slate" />
          </div>

          {/* Agent list with presence */}
          <div className="space-y-2.5">
            {agentStats.map((stat) => (
              <div key={stat.member.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center text-sm font-bold">
                      {stat.member.full_name?.[0] || stat.member.username[0].toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${PRESENCE_COLORS[stat.presence]} border-2 border-white`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{stat.member.full_name || stat.member.username}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        stat.presence === 'online' ? 'bg-emerald-50 text-emerald-600' :
                        stat.presence === 'idle' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {PRESENCE_LABELS[stat.presence]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {stat.firstLogin ? `Logged in ${timeAgo(stat.firstLogin)}` : 'Not logged in today'}
                      {stat.member.last_active_at && ` · Active ${timeAgo(stat.member.last_active_at)}`}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-bold text-blue-600">{stat.callsLogged}</p>
                      <p className="text-[10px] text-gray-400 uppercase">Calls</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-600">{stat.whatsappLogged}</p>
                      <p className="text-[10px] text-gray-400 uppercase">WhatsApp</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-600">{stat.leadsUpdated}</p>
                      <p className="text-[10px] text-gray-400 uppercase">Updates</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1E293B]">{stat.activeHours}</p>
                      <p className="text-[10px] text-gray-400 uppercase">Active</p>
                    </div>
                  </div>
                </div>
                {/* Mobile stats */}
                <div className="sm:hidden mt-3 grid grid-cols-4 gap-2 text-center pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-blue-600">{stat.callsLogged}</p>
                    <p className="text-[10px] text-gray-400">Calls</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-600">{stat.whatsappLogged}</p>
                    <p className="text-[10px] text-gray-400">WhatsApp</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600">{stat.leadsUpdated}</p>
                    <p className="text-[10px] text-gray-400">Updates</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1E293B]">{stat.activeHours}</p>
                    <p className="text-[10px] text-gray-400">Active</p>
                  </div>
                </div>
              </div>
            ))}
            {agentStats.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <Users size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No team members found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {tab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider"><LogIn size={12} className="inline mr-1 -mt-0.5" />Login</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider"><LogOut size={12} className="inline mr-1 -mt-0.5" />Logout</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider"><Clock size={12} className="inline mr-1 -mt-0.5" />Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((s) => {
                  const duration = s.logout_at
                    ? new Date(s.logout_at).getTime() - new Date(s.login_at).getTime()
                    : Date.now() - new Date(s.login_at).getTime();
                  const durMin = Math.floor(duration / 60000);
                  const durH = Math.floor(durMin / 60);
                  const durM = durMin % 60;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {userName(s.user_id)[0] || '?'}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{userName(s.user_id)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(s.login_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.logout_at ? formatDateTime(s.logout_at) : <span className="text-emerald-600 font-medium">Active now</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-[#1E293B]">
                          {durH > 0 ? `${durH}h ${durM}m` : `${durM}m`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No sessions on {formatDate(dateFilter)}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {filteredSessions.map((s) => {
              const duration = s.logout_at
                ? new Date(s.logout_at).getTime() - new Date(s.login_at).getTime()
                : Date.now() - new Date(s.login_at).getTime();
              const durMin = Math.floor(duration / 60000);
              const durH = Math.floor(durMin / 60);
              const durM = durMin % 60;
              return (
                <div key={s.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {userName(s.user_id)[0] || '?'}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{userName(s.user_id)}</span>
                    {!s.logout_at && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">Login:</span> <span className="text-gray-600">{formatDateTime(s.login_at)}</span></div>
                    <div><span className="text-gray-400">Logout:</span> <span className="text-gray-600">{s.logout_at ? formatDateTime(s.logout_at) : '—'}</span></div>
                    <div><span className="text-gray-400">Duration:</span> <span className="text-gray-900 font-semibold">{durH > 0 ? `${durH}h ${durM}m` : `${durM}m`}</span></div>
                  </div>
                </div>
              );
            })}
            {filteredSessions.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No sessions on {formatDate(dateFilter)}</div>
            )}
          </div>
        </div>
      )}

      {/* ── Audit Trail Tab ── */}
      {tab === 'activity' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {filteredActivity.length === 0 ? (
            <div className="text-center py-12">
              <Activity size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No activity recorded on {formatDate(dateFilter)}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
              {filteredActivity.map((log) => {
                const isCall = log.action.toLowerCase().includes('call');
                const isWhatsApp = log.action.toLowerCase().includes('whatsapp');
                const isEdit = log.action.toLowerCase().includes('edit') || log.action.toLowerCase().includes('update');
                const isCreate = log.action.toLowerCase().includes('created') || log.action.toLowerCase().includes('add');
                const isReassign = log.action.toLowerCase().includes('reassign');

                const Icon = isCall ? Phone : isWhatsApp ? MessageCircle : isCreate ? TrendingUp : isReassign ? Users : isEdit ? Edit3 : Activity;
                const colorClass = isCall ? 'bg-blue-100 text-blue-600' : isWhatsApp ? 'bg-green-100 text-green-600' : isCreate ? 'bg-sky-100 text-sky-600' : isReassign ? 'bg-orange-100 text-orange-600' : isEdit ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-500';

                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition">
                    <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                      {log.detail && <p className="text-xs text-gray-500 mt-0.5 break-words">{log.detail}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{formatDateTime(log.created_at)}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500 font-medium">{userName(log.user_id)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  tab,
  value,
  onClick,
  icon: Icon,
  label,
}: {
  tab: Tab;
  value: Tab;
  onClick: (t: Tab) => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
        tab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function PresenceCard({ label, count, color }: { label: string; count: number; color: 'emerald' | 'amber' | 'slate' }) {
  const colorMap = {
    emerald: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' },
    slate: { dot: 'bg-slate-300', text: 'text-slate-500', bg: 'bg-slate-50' },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl border border-slate-200 p-4 ${c.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
        <span className={`text-xs font-bold ${c.text} uppercase tracking-wider`}>{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{count}</p>
    </div>
  );
}
