import { useEffect, useState, useMemo, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, Target, DollarSign, Award, Filter, Hourglass } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import {
  Lead,
  User,
  LEAD_STAGES,
  LEAD_SOURCES,
  STAGE_COLORS,
  LeadStage,
  LeadSource,
  getLeadAging,
  DatePreset,
  DateRange,
  getPresetRange,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import DateFilter from '@/components/ui/DateFilter';

export default function Analytics() {
  const { user, isAgent, canExport, isManager } = useAuth();
  const getVisibleAgentIds = useVisibleAgentIds();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const currentRange = useMemo((): DateRange | null => {
    if (datePreset === 'custom') return customRange;
    if (datePreset === 'all') return null;
    return getPresetRange(datePreset);
  }, [datePreset, customRange]);

  const fetchData = useCallback(async () => {
    let query = supabase.from('leads').select('*');
    if (isAgent && user) {
      query = query.eq('assigned_to', user.id);
    } else if (isManager && getVisibleAgentIds) {
      const agentIds = await getVisibleAgentIds();
      if (agentIds && agentIds.length > 0) {
        query = query.in('assigned_to', agentIds);
      } else {
        query = query.eq('assigned_to', user!.id);
      }
    }
    if (currentRange) {
      query = query.gte('created_at', currentRange.start.toISOString()).lte('created_at', currentRange.end.toISOString());
    }
    const { data: leadData } = await query.order('created_at', { ascending: false });
    setLeads((leadData as Lead[]) || []);

    let userQuery = supabase.from('users').select('*');
    if (isManager && getVisibleAgentIds) {
      const agentIds = await getVisibleAgentIds();
      if (agentIds) userQuery = userQuery.in('id', agentIds);
    }
    const { data: userData } = await userQuery;
    setUsers((userData as User[]) || []);
    setLoading(false);
  }, [user, isAgent, isManager, getVisibleAgentIds, currentRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDebouncedRealtimeLeads(fetchData);

  const filteredLeads = useMemo(() => {
    if (sourceFilter === 'all') return leads;
    return leads.filter((l) => l.lead_source === sourceFilter);
  }, [leads, sourceFilter]);

  const metrics = useMemo(() => {
    const total = filteredLeads.length;
    const won = filteredLeads.filter((l) => l.stage === 'Won');
    const lost = filteredLeads.filter((l) => l.stage === 'Lost');
    const active = filteredLeads.filter((l) => !['Won', 'Lost'].includes(l.stage));
    const totalToken = filteredLeads
      .filter((l) => l.token_amount)
      .reduce((sum, l) => sum + (l.token_amount || 0), 0);
    const conversionRate = total > 0 ? ((won.length / total) * 100).toFixed(1) : '0.0';
    const lossRate = total > 0 ? ((lost.length / total) * 100).toFixed(1) : '0.0';

    // Closing metrics
    const avgDaysToWin = won.length > 0
      ? Math.round(won.reduce((sum, l) => sum + (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000, 0) / won.length)
      : 0;
    const avgDaysToLoss = lost.length > 0
      ? Math.round(lost.reduce((sum, l) => sum + (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000, 0) / lost.length)
      : 0;
    const agedLeads = active.filter((l) => {
      const aging = getLeadAging(l.created_at, l.stage);
      return aging && aging.days > 15;
    }).length;

    return { total, won: won.length, lost: lost.length, active, totalToken, conversionRate, lossRate, avgDaysToWin, avgDaysToLoss, agedLeads };
  }, [filteredLeads]);

  const sourceBreakdown = useMemo(() => {
    return LEAD_SOURCES.map((source) => {
      const sourceLeads = leads.filter((l) => l.lead_source === source);
      const won = sourceLeads.filter((l) => l.stage === 'Won').length;
      return {
        source,
        total: sourceLeads.length,
        won,
        conversion: sourceLeads.length > 0 ? ((won / sourceLeads.length) * 100).toFixed(0) : '0',
      };
    }).filter((s) => s.total > 0);
  }, [leads]);

  const agentPerformance = useMemo(() => {
    return users
      .filter((u) => u.role === 'agent' || u.role === 'manager')
      .map((agent) => {
        const agentLeads = filteredLeads.filter((l) => l.assigned_to === agent.id);
        const won = agentLeads.filter((l) => l.stage === 'Won').length;
        const lost = agentLeads.filter((l) => l.stage === 'Lost').length;
        const active = agentLeads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length;
        const token = agentLeads
          .filter((l) => l.token_amount)
          .reduce((sum, l) => sum + (l.token_amount || 0), 0);
        return {
          agent,
          total: agentLeads.length,
          won,
          lost,
          active,
          token,
          conversion: agentLeads.length > 0 ? ((won / agentLeads.length) * 100).toFixed(0) : '0',
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.won - a.won);
  }, [filteredLeads, users]);

  const exportCSV = () => {
    const headers = [
      'Client Name', 'Phone', 'Requirement', 'Budget Range', 'Lead Source',
      'Stage', 'Assigned Agent', 'Next Follow-up', 'Token Amount', 'Call Outcome',
      'Notes', 'Created At', 'Updated At',
    ];

    const rows = filteredLeads.map((l) => [
      l.client_name, l.phone, l.requirement || '', l.budget_range || '',
      l.lead_source, l.stage,
      users.find((u) => u.id === l.assigned_to)?.full_name || 'Unassigned',
      l.next_followup_at ? new Date(l.next_followup_at).toLocaleString() : '',
      l.token_amount?.toString() || '', l.call_outcome || '',
      l.notes.replace(/"/g, '""'),
      new Date(l.created_at).toLocaleString(),
      new Date(l.updated_at).toLocaleString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propertyfy-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header + Date filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Sales performance insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateFilter
            preset={datePreset}
            range={customRange}
            onPresetChange={(p) => { setDatePreset(p); setLoading(true); }}
            onCustomRangeChange={(r) => { setCustomRange(r); setLoading(true); }}
          />
          {canExport && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c4a030] text-[#1E293B] font-semibold shadow-lg shadow-[#D4AF37]/20 transition active:scale-95"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Source filter pills — wrapped cleanly for mobile */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-400 flex-shrink-0" />
        <FilterPill
          label="All Sources"
          active={sourceFilter === 'all'}
          onClick={() => setSourceFilter('all')}
        />
        {LEAD_SOURCES.map((source) => (
          <FilterPill
            key={source}
            label={source}
            active={sourceFilter === source}
            onClick={() => setSourceFilter(source)}
          />
        ))}
      </div>

      {/* Top metrics — full-width on mobile, grid on larger */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <MetricCard label="Total Leads" value={metrics.total.toString()} icon={Target} color="bg-sky-500" sub={`${metrics.active} active`} />
        <MetricCard label="Conversion" value={`${metrics.conversionRate}%`} icon={TrendingUp} color="bg-[#D4AF37]" sub={`${metrics.won} won`} />
        <MetricCard label="Loss Rate" value={`${metrics.lossRate}%`} icon={TrendingDown} color="bg-slate-500" sub={`${metrics.lost} lost`} />
        <MetricCard label="Token Value" value={formatCurrency(metrics.totalToken)} icon={DollarSign} color="bg-[#D4AF37]" />
      </div>

      {/* Closing Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <MetricCard label="Avg Days to Win" value={`${metrics.avgDaysToWin}d`} icon={TrendingUp} color="bg-emerald-500" sub={`${metrics.won} won deals`} />
        <MetricCard label="Avg Days to Loss" value={`${metrics.avgDaysToLoss}d`} icon={TrendingDown} color="bg-rose-500" sub={`${metrics.lost} lost deals`} />
        <MetricCard label="Aged Leads (>15d)" value={metrics.agedLeads.toString()} icon={Hourglass} color="bg-red-500" sub={metrics.agedLeads > 0 ? 'Needs attention' : 'All fresh'} />
      </div>

      {/* Stage + Source breakdown — stacked on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Stage distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 lg:p-6 w-full overflow-hidden">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-5">Stage Distribution</h2>
          <div className="space-y-2.5 sm:space-y-3">
            {LEAD_STAGES.map((stage: LeadStage) => {
              const count = filteredLeads.filter((l) => l.stage === stage).length;
              const colors = STAGE_COLORS[stage];
              const pct = metrics.total > 0 ? (count / metrics.total) * 100 : 0;
              return (
                <div key={stage} className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 w-20 sm:w-36 flex-shrink-0 truncate">{stage}</span>
                  <div className="flex-1 h-5 sm:h-6 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${colors.dot} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-6 sm:w-8 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 lg:p-6 w-full overflow-hidden">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-5">Lead Source Performance</h2>
          <div className="space-y-3 sm:space-y-4">
            {sourceBreakdown.map(({ source, total, won, conversion }) => {
              const pct = metrics.total > 0 ? (total / metrics.total) * 100 : 0;
              return (
                <div key={source}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{source}</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                      {total} · {won} won · {conversion}%
                    </span>
                  </div>
                  <div className="h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#F97316] to-[#D4AF37] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {sourceBreakdown.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No source data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent performance — scrollable table on mobile, full table on desktop */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 lg:p-6 w-full overflow-hidden">
        <div className="flex items-center gap-2 mb-4 sm:mb-5">
          <Award size={20} className="text-[#D4AF37]" />
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Team Leaderboard</h2>
        </div>

        {/* Mobile: card-based layout */}
        <div className="sm:hidden space-y-3">
          {agentPerformance.map((row, i) => (
            <div key={row.agent.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-[#D4AF37] text-[#1E293B]' : 'bg-slate-100 text-slate-500'
                }`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {row.agent.full_name?.[0] || row.agent.username[0].toUpperCase()}
                </div>
                <span className="font-semibold text-gray-900 text-sm truncate">
                  {row.agent.full_name || row.agent.username}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Stat label="Total" value={row.total.toString()} />
                <Stat label="Won" value={row.won.toString()} color="text-[#D4AF37]" />
                <Stat label="Conv." value={`${row.conversion}%`} />
                <Stat label="Token" value={row.token > 0 ? formatCurrency(row.token) : '—'} color="text-[#D4AF37]" />
              </div>
            </div>
          ))}
          {agentPerformance.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No agent data yet</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="pb-3 pr-4 font-semibold">#</th>
                <th className="pb-3 pr-4 font-semibold">Agent</th>
                <th className="pb-3 pr-4 font-semibold text-center">Total</th>
                <th className="pb-3 pr-4 font-semibold text-center">Active</th>
                <th className="pb-3 pr-4 font-semibold text-center">Won</th>
                <th className="pb-3 pr-4 font-semibold text-center">Lost</th>
                <th className="pb-3 pr-4 font-semibold text-center">Conv.</th>
                <th className="pb-3 font-semibold text-right">Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agentPerformance.map((row, i) => (
                <tr key={row.agent.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-[#D4AF37] text-[#1E293B]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {row.agent.full_name?.[0] || row.agent.username[0].toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900 whitespace-nowrap">
                        {row.agent.full_name || row.agent.username}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-center font-medium text-gray-700">{row.total}</td>
                  <td className="py-3 pr-4 text-center font-medium text-sky-600">{row.active}</td>
                  <td className="py-3 pr-4 text-center font-bold text-[#D4AF37]">{row.won}</td>
                  <td className="py-3 pr-4 text-center font-medium text-gray-500">{row.lost}</td>
                  <td className="py-3 pr-4 text-center font-semibold text-gray-700">{row.conversion}%</td>
                  <td className="py-3 text-right font-semibold text-[#D4AF37] whitespace-nowrap">
                    {row.token > 0 ? formatCurrency(row.token) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap ${
        active
          ? 'bg-[#1E293B] text-white border-[#1E293B]'
          : 'bg-white text-gray-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: typeof Target;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 lg:p-5 w-full">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${color} flex items-center justify-center text-white shadow-sm mb-2.5 sm:mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
