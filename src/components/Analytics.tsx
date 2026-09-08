import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Download, TrendingUp, TrendingDown, Target, DollarSign, Award, Filter, Hourglass,
  CheckCircle2, XCircle, Building2, MapPin, ChevronRight,
  Filter as FilterIcon, PieChart, BarChart3, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import {
  Lead, User as UserType, Project,
  LEAD_STAGES, LEAD_SOURCES, STAGE_COLORS,
  LeadStage, LeadSource,
  getLeadAging,
  DatePreset, DateRange, getPresetRange,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import DateFilter from '@/components/ui/DateFilter';

interface ActivityLog {
  id: string;
  lead_id: string;
  user_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export default function Analytics() {
  const { user, isAgent, canExport, isManager } = useAuth();
  const getVisibleAgentIds = useVisibleAgentIds();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

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
    const fetchedLeads = (leadData as Lead[]) || [];
    setLeads(fetchedLeads);

    let userQuery = supabase.from('users').select('*');
    if (isManager && getVisibleAgentIds) {
      const agentIds = await getVisibleAgentIds();
      if (agentIds) userQuery = userQuery.in('id', agentIds);
    }
    const { data: userData } = await userQuery;
    setUsers((userData as UserType[]) || []);

    const { data: projData } = await supabase.from('projects').select('*');
    setProjects((projData as Project[]) || []);

    const leadIds = fetchedLeads.map((l) => l.id);
    if (leadIds.length > 0) {
      const { data: logData } = await supabase
        .from('activity_logs')
        .select('*')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      setActivityLogs((logData as ActivityLog[]) || []);
    } else {
      setActivityLogs([]);
    }

    setLoading(false);
  }, [user, isAgent, isManager, getVisibleAgentIds, currentRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDebouncedRealtimeLeads(fetchData);

  // Apply all dynamic filters: source, agent, project
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (sourceFilter !== 'all') result = result.filter((l) => l.lead_source === sourceFilter);
    if (!isAgent && agentFilter !== 'all') result = result.filter((l) => l.assigned_to === agentFilter);
    if (projectFilter !== 'all') result = result.filter((l) => l.project_id === projectFilter);
    return result;
  }, [leads, sourceFilter, agentFilter, projectFilter, isAgent]);

  const agentName = useCallback((id: string | null) => {
    if (!id) return 'Unassigned';
    const u = users.find((a) => a.id === id);
    return u?.full_name || u?.username || 'Unknown';
  }, [users]);

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

    return { total, won: won.length, lost: lost.length, active: active.length, totalToken, conversionRate, lossRate, avgDaysToWin, avgDaysToLoss, agedLeads };
  }, [filteredLeads]);

  const funnel = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const meetings = activityLogs.filter(
      (log) => log.action.toLowerCase().includes('meeting') || log.action.toLowerCase().includes('site visit')
    );
    const meetingLeadIds = new Set(meetings.map((m) => m.lead_id));
    const meetingCount = filteredLeads.filter((l) => meetingLeadIds.has(l.id)).length;

    const tokenCount = filteredLeads.filter(
      (l) => l.stage === 'Token Received' || l.stage === 'Won' || (l.token_amount && l.token_amount > 0)
    ).length;

    const wonCount = filteredLeads.filter((l) => l.stage === 'Won').length;

    return [
      { label: 'Total Leads', count: totalLeads, color: 'bg-sky-500', pct: 100 },
      { label: 'Meetings / Site Visits', count: meetingCount, color: 'bg-violet-500', pct: totalLeads > 0 ? (meetingCount / totalLeads) * 100 : 0 },
      { label: 'Token Received', count: tokenCount, color: 'bg-[#D4AF37]', pct: totalLeads > 0 ? (tokenCount / totalLeads) * 100 : 0 },
      { label: 'Deals Won', count: wonCount, color: 'bg-emerald-500', pct: totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0 },
    ];
  }, [filteredLeads, activityLogs]);

  const agentPerformance = useMemo(() => {
    return users
      .filter((u) => u.role === 'agent' || u.role === 'manager')
      .map((agent) => {
        const agentLeads = filteredLeads.filter((l) => l.assigned_to === agent.id);
        const agentLeadIds = new Set(agentLeads.map((l) => l.id));
        const won = agentLeads.filter((l) => l.stage === 'Won').length;
        const lost = agentLeads.filter((l) => l.stage === 'Lost').length;
        const active = agentLeads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length;
        const token = agentLeads
          .filter((l) => l.token_amount)
          .reduce((sum, l) => sum + (l.token_amount || 0), 0);

        const callsMade = activityLogs.filter(
          (log) => agentLeadIds.has(log.lead_id) && log.action.toLowerCase().includes('call')
        ).length;

        const followupsCompleted = agentLeads.filter(
          (l) => l.next_followup_at && new Date(l.next_followup_at).getTime() < Date.now() && !['Won', 'Lost', 'Follow-up Date'].includes(l.stage)
        ).length;

        const followupsMissed = agentLeads.filter((l) => {
          if (!l.next_followup_at || ['Won', 'Lost'].includes(l.stage)) return false;
          return new Date(l.next_followup_at).getTime() < Date.now();
        }).length;

        return {
          agent,
          total: agentLeads.length,
          won, lost, active, token,
          callsMade,
          followupsCompleted,
          followupsMissed,
          conversion: agentLeads.length > 0 ? ((won / agentLeads.length) * 100).toFixed(0) : '0',
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.won - a.won);
  }, [filteredLeads, users, activityLogs]);

  const projectBreakdown = useMemo(() => {
    return projects.map((proj) => {
      const projLeads = filteredLeads.filter((l) => l.project_id === proj.id);
      const won = projLeads.filter((l) => l.stage === 'Won').length;
      return {
        project: proj,
        total: projLeads.length,
        won,
        lost: projLeads.filter((l) => l.stage === 'Lost').length,
        active: projLeads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length,
        conversion: projLeads.length > 0 ? ((won / projLeads.length) * 100).toFixed(0) : '0',
      };
    }).filter((p) => p.total > 0);
  }, [filteredLeads, projects]);

  const sourceBreakdown = useMemo(() => {
    return LEAD_SOURCES.map((source) => {
      const sourceLeads = filteredLeads.filter((l) => l.lead_source === source);
      const won = sourceLeads.filter((l) => l.stage === 'Won').length;
      return {
        source,
        total: sourceLeads.length,
        won,
        lost: sourceLeads.filter((l) => l.stage === 'Lost').length,
        conversion: sourceLeads.length > 0 ? ((won / sourceLeads.length) * 100).toFixed(0) : '0',
      };
    }).filter((s) => s.total > 0);
  }, [filteredLeads]);

  const lostAnalysis = useMemo(() => {
    const lostLeads = filteredLeads.filter((l) => l.stage === 'Lost');
    const total = lostLeads.length;
    const reasonMap = new Map<string, number>();
    for (const lead of lostLeads) {
      const reason = lead.lost_reason || 'Unspecified';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }
    const reasons = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count, pct: total > 0 ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    const lossBySource = LEAD_SOURCES.map((source) => ({
      source,
      count: lostLeads.filter((l) => l.lead_source === source).length,
    })).filter((s) => s.count > 0);
    return { total, reasons, lossBySource };
  }, [filteredLeads]);

  const exportCSV = () => {
    const headers = [
      'Client Name', 'Phone', 'Requirement', 'Budget Range', 'Lead Source',
      'Stage', 'Assigned Agent', 'Next Follow-up', 'Token Amount', 'Call Outcome',
      'Lost Reason', 'Notes', 'Created At', 'Updated At',
    ];
    const rows = filteredLeads.map((l) => [
      l.client_name, l.phone, l.requirement || '', l.budget_range || '',
      l.lead_source, l.stage,
      agentName(l.assigned_to),
      l.next_followup_at ? new Date(l.next_followup_at).toLocaleString() : '',
      l.token_amount?.toString() || '', l.call_outcome || '',
      l.lost_reason || '',
      l.notes.replace(/"/g, '""'),
      new Date(l.created_at).toLocaleString(),
      new Date(l.updated_at).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propertyfy-analytics-${new Date().toISOString().split('T')[0]}.csv`;
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
          <h1 className="text-2xl font-bold text-[#0F172A]">Analytics</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Sales performance insights</p>
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c4a030] text-[#1E293B] font-semibold shadow-md transition active:scale-95"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic filters: Agent, Project, Source */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-slate-400 flex-shrink-0" />
        {/* Agent filter */}
        {!isAgent && (
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full surface-dark text-slate-600 text-sm font-medium focus:border-[#D4AF37] outline-none transition cursor-pointer"
          >
            <option value="all">All Agents</option>
            {users.filter((u) => u.role === 'agent' || u.role === 'manager').map((u) => (
              <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
            ))}
          </select>
        )}
        {/* Project filter */}
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full surface-dark text-slate-600 text-sm font-medium focus:border-[#D4AF37] outline-none transition cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {/* Source filter pills */}
        <FilterPill label="All Sources" active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')} />
        {LEAD_SOURCES.map((source) => (
          <FilterPill key={source} label={source} active={sourceFilter === source} onClick={() => setSourceFilter(source)} />
        ))}
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <MetricCard label="Total Leads" value={metrics.total.toString()} icon={Target} color="bg-sky-500" sub={`${metrics.active} active`} />
        <MetricCard label="Conversion" value={`${metrics.conversionRate}%`} icon={TrendingUp} color="bg-[#D4AF37]" sub={`${metrics.won} won`} />
        <MetricCard label="Loss Rate" value={`${metrics.lossRate}%`} icon={TrendingDown} color="bg-rose-500" sub={`${metrics.lost} lost`} />
        <MetricCard label="Token Value" value={formatCurrency(metrics.totalToken)} icon={DollarSign} color="bg-[#D4AF37]" />
      </div>

      {/* Closing Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <MetricCard label="Avg Days to Win" value={`${metrics.avgDaysToWin}d`} icon={TrendingUp} color="bg-emerald-500" sub={`${metrics.won} won deals`} />
        <MetricCard label="Avg Days to Loss" value={`${metrics.avgDaysToLoss}d`} icon={TrendingDown} color="bg-rose-500" sub={`${metrics.lost} lost deals`} />
        <MetricCard label="Aged Leads (>15d)" value={metrics.agedLeads.toString()} icon={Hourglass} color="bg-red-500" sub={metrics.agedLeads > 0 ? 'Needs attention' : 'All fresh'} />
      </div>

      {/* Conversion Funnel */}
      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-5">
          <FilterIcon size={20} className="text-[#D4AF37]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Conversion Funnel</h2>
        </div>
        <div className="space-y-3">
          {funnel.map((stage, i) => (
            <div key={stage.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-600">{stage.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">{stage.count}</span>
                  <span className="text-xs text-slate-400">({stage.pct.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${stage.color} transition-all duration-700 flex items-center justify-end pr-3`}
                  style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 5 : 0)}%` }}
                >
                  {stage.count > 0 && <span className="text-[10px] font-bold text-white">{stage.pct.toFixed(0)}%</span>}
                </div>
              </div>
              {i < funnel.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ChevronRight size={12} className="text-slate-300 rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stage distribution + Source breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="glass-card p-5 lg:p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">Stage Distribution</h2>
          <div className="space-y-3">
            {LEAD_STAGES.map((stage: LeadStage) => {
              const count = filteredLeads.filter((l) => l.stage === stage).length;
              const colors = STAGE_COLORS[stage];
              const pct = metrics.total > 0 ? (count / metrics.total) * 100 : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600 w-28 lg:w-36 flex-shrink-0 truncate">{stage}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${colors.dot} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-[#0F172A] w-8 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5 lg:p-6">
          <h2 className="text-lg font-bold text-[#0F172A] mb-5">Lead Source Performance</h2>
          <div className="space-y-4">
            {sourceBreakdown.map(({ source, total, won, lost, conversion }) => {
              const pct = metrics.total > 0 ? (total / metrics.total) * 100 : 0;
              return (
                <div key={source}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm font-medium text-slate-600 truncate">{source}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {total} · {won} won · {lost} lost · {conversion}%
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#F97316] to-[#D4AF37] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {sourceBreakdown.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">No source data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Project-wise distribution */}
      {projectBreakdown.length > 0 && (
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Building2 size={20} className="text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-[#0F172A]">Project-wise Distribution</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectBreakdown.map(({ project, total, won, lost, active, conversion }) => (
              <div key={project.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F172A] truncate">{project.name}</p>
                    {project.location && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {project.location}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    project.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="Total" value={total.toString()} />
                  <Stat label="Active" value={active.toString()} color="text-sky-600" />
                  <Stat label="Won" value={won.toString()} color="text-emerald-600" />
                  <Stat label="Conv." value={`${conversion}%`} color="text-[#a67c00]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Performance Matrix */}
      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Award size={20} className="text-[#D4AF37]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Sales Agent Performance Matrix</h2>
        </div>

        {/* Mobile: card layout */}
        <div className="sm:hidden space-y-3">
          {agentPerformance.map((row, i) => (
            <div key={row.agent.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-[#D4AF37] text-[#1E293B]' : 'bg-slate-200 text-slate-500'
                }`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#a67c00] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {row.agent.full_name?.[0] || row.agent.username[0].toUpperCase()}
                </div>
                <span className="font-bold text-[#0F172A] text-sm truncate">
                  {row.agent.full_name || row.agent.username}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Calls" value={row.callsMade.toString()} color="text-blue-600" />
                <Stat label="Won" value={row.won.toString()} color="text-emerald-600" />
                <Stat label="Conv." value={`${row.conversion}%`} color="text-[#a67c00]" />
                <Stat label="FU Done" value={row.followupsCompleted.toString()} color="text-emerald-600" />
                <Stat label="FU Missed" value={row.followupsMissed.toString()} color={row.followupsMissed > 0 ? 'text-red-600' : 'text-slate-400'} />
                <Stat label="Total" value={row.total.toString()} />
              </div>
            </div>
          ))}
          {agentPerformance.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No agent data yet</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pr-4 font-semibold">#</th>
                <th className="pb-3 pr-4 font-semibold">Agent</th>
                <th className="pb-3 pr-4 font-semibold text-center">Total</th>
                <th className="pb-3 pr-4 font-semibold text-center">Calls</th>
                <th className="pb-3 pr-4 font-semibold text-center">FU Done</th>
                <th className="pb-3 pr-4 font-semibold text-center">FU Missed</th>
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
                      i === 0 ? 'bg-[#D4AF37] text-[#1E293B]' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 text-[#a67c00] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {row.agent.full_name?.[0] || row.agent.username[0].toUpperCase()}
                      </div>
                      <span className="font-bold text-[#0F172A] whitespace-nowrap">
                        {row.agent.full_name || row.agent.username}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-center font-medium text-slate-600">{row.total}</td>
                  <td className="py-3 pr-4 text-center font-medium text-blue-600">{row.callsMade}</td>
                  <td className="py-3 pr-4 text-center font-medium text-emerald-600">{row.followupsCompleted}</td>
                  <td className="py-3 pr-4 text-center font-medium">
                    <span className={row.followupsMissed > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                      {row.followupsMissed}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-center font-bold text-emerald-600">{row.won}</td>
                  <td className="py-3 pr-4 text-center font-medium text-slate-400">{row.lost}</td>
                  <td className="py-3 pr-4 text-center font-semibold text-[#a67c00]">{row.conversion}%</td>
                  <td className="py-3 text-right font-semibold text-[#a67c00] whitespace-nowrap">
                    {row.token > 0 ? formatCurrency(row.token) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lost Lead Analysis */}
      {lostAnalysis.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="glass-card p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-5">
              <XCircle size={20} className="text-red-500" />
              <h2 className="text-lg font-bold text-[#0F172A]">Lost Lead Reasons</h2>
              <span className="text-xs text-slate-400 ml-auto">{lostAnalysis.total} lost</span>
            </div>
            <div className="space-y-3">
              {lostAnalysis.reasons.map(({ reason, count, pct }) => (
                <div key={reason}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-600">{reason}</span>
                    <span className="text-xs text-slate-400">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-rose-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={20} className="text-red-500" />
              <h2 className="text-lg font-bold text-[#0F172A]">Loss by Lead Source</h2>
            </div>
            <div className="space-y-3">
              {lostAnalysis.lossBySource.map(({ source, count }) => {
                const pct = lostAnalysis.total > 0 ? (count / lostAnalysis.total) * 100 : 0;
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-600">{source}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {metrics.total === 0 && (
        <div className="glass-card text-center py-12">
          <PieChart size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No data for this period</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your date range or filters</p>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap ${
        active
          ? 'bg-[#D4AF37] text-[#1E293B] border-[#D4AF37]'
          : 'surface-dark text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string; icon: typeof Target; color: string; sub?: string;
}) {
  return (
    <div className="stat-card-glass p-4 lg:p-5">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white shadow-md mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-xl lg:text-2xl font-bold text-[#0F172A]">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, color = 'text-slate-700' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
