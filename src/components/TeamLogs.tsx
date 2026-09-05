import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { User, SessionLog } from '@/lib/types';
import { formatDateTime, formatDate } from '@/lib/utils';
import { Clock, Phone, Edit3, LogIn, LogOut, Calendar } from 'lucide-react';

interface TeamLogsProps {
  users: User[];
}

interface AgentDayStat {
  user: User;
  loginTime: string | null;
  logoutTime: string | null;
  activeHours: string;
  callsLogged: number;
  leadsUpdated: number;
}

export default function TeamLogs({ users }: TeamLogsProps) {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<{ user_id: string | null; action: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const fetchData = async () => {
      const dayStart = new Date(dateFilter + 'T00:00:00');
      const dayEnd = new Date(dateFilter + 'T23:59:59');

      const { data: sessionData } = await supabase
        .from('session_logs')
        .select('*')
        .gte('login_at', dayStart.toISOString())
        .lte('login_at', dayEnd.toISOString())
        .order('login_at', { ascending: true });

      setSessions((sessionData as SessionLog[]) || []);

      const { data: actData } = await supabase
        .from('activity_logs')
        .select('user_id, action, created_at')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      setActivityLogs((actData as { user_id: string | null; action: string; created_at: string }[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [dateFilter]);

  const teamMembers = useMemo(() => users.filter((u) => u.role === 'agent' || u.role === 'manager'), [users]);

  const stats: AgentDayStat[] = useMemo(() => {
    return teamMembers.map((member) => {
      const memberSessions = sessions.filter((s) => s.user_id === member.id);
      const firstLogin = memberSessions.length > 0 ? memberSessions[0].login_at : null;
      const lastLogout = memberSessions
        .filter((s) => s.logout_at)
        .sort((a, b) => new Date(b.logout_at!).getTime() - new Date(a.logout_at!).getTime())[0]?.logout_at || null;

      // Calculate active hours from sessions
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
      const leadsUpdated = memberActivity.filter((a) =>
        a.action.toLowerCase().includes('updated') ||
        a.action.toLowerCase().includes('quick edit') ||
        a.action.toLowerCase().includes('reassign')
      ).length;

      return {
        user: member,
        loginTime: firstLogin,
        logoutTime: lastLogout,
        activeHours,
        callsLogged,
        leadsUpdated,
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
    <div className="space-y-4">
      {/* Date filter */}
      <div className="flex items-center gap-3">
        <Calendar size={18} className="text-gray-400" />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setLoading(true);
          }}
          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-gray-900 text-sm font-medium focus:border-[#D4AF37] outline-none transition"
        />
        <span className="text-sm text-gray-500">{formatDate(dateFilter)}</span>
      </div>

      {/* Stats table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Team Member</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <LogIn size={12} className="inline mr-1 -mt-0.5" /> Login
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <LogOut size={12} className="inline mr-1 -mt-0.5" /> Logout
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <Clock size={12} className="inline mr-1 -mt-0.5" /> Active Hrs
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <Phone size={12} className="inline mr-1 -mt-0.5" /> Calls
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <Edit3 size={12} className="inline mr-1 -mt-0.5" /> Updates
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {stat.user.full_name?.[0] || stat.user.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{stat.user.full_name || stat.user.username}</p>
                        <p className="text-[10px] text-gray-400 capitalize">{stat.user.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {stat.loginTime ? formatDateTime(stat.loginTime) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {stat.logoutTime ? formatDateTime(stat.logoutTime) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E293B]">
                      <Clock size={13} className="text-gray-400" />
                      {stat.activeHours}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-sm font-bold">
                      {stat.callsLogged}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold">
                      {stat.leadsUpdated}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                    No team members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
