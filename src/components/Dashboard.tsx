import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  Users as UsersIcon,
  Target,
  DollarSign,
  Briefcase,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CheckCircle2,
  PhoneIncoming,
  Phone,
  MessageCircle,
  Edit3,
  X,
  Hourglass,
  TrendingDown,
  AlertTriangle,
  UserX,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import {
  Lead,
  User,
  Project,
  InteractionType,
  LeadStage,
  LEAD_STAGES,
  STAGE_COLORS,
  getPresence,
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  getLeadAging,
  AGING_COLORS,
  DatePreset,
  DateRange,
  getPresetRange,
} from '@/lib/types';
import { formatCurrency, formatDateTime, timeAgo, telLink, whatsappLink } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import QuickEditDrawer from '@/components/QuickEditDrawer';
import InboundCallModal from '@/components/InboundCallModal';
import LogInteractionModal from '@/components/LogInteractionModal';
import DateFilter from '@/components/ui/DateFilter';

interface DashboardProps {
  onNavigate: (page: 'leads' | 'analytics') => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, isSuperAdmin, isManager, isAgent } = useAuth();
  const getVisibleAgentIds = useVisibleAgentIds();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null);
  const [showInbound, setShowInbound] = useState(false);
  const [logLead, setLogLead] = useState<Lead | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>('call');

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');

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
    const { data: leadData } = await query.order('updated_at', { ascending: false });
    setLeads((leadData as Lead[]) || []);

    let userQuery = supabase.from('users').select('*');
    if (isManager && getVisibleAgentIds) {
      const agentIds = await getVisibleAgentIds();
      if (agentIds) userQuery = userQuery.in('id', agentIds);
    }
    const { data: userData } = await userQuery.order('created_at', { ascending: true });
    setAgents((userData as User[]) || []);

    if (projects.length === 0) {
      const { data: projData } = await supabase.from('projects').select('*');
      setProjects((projData as Project[]) || []);
    }

    setLoading(false);
  }, [user, isAgent, isManager, getVisibleAgentIds, currentRange, projects.length]);

  useEffect(() => {
    fetchData();
    const presenceTimer = setInterval(fetchData, 60000);
    return () => clearInterval(presenceTimer);
  }, [fetchData]);

  useDebouncedRealtimeLeads(fetchData);

  // Apply project filter to leads
  const filteredLeads = useMemo(() => {
    if (projectFilter === 'all') return leads;
    return leads.filter((l) => l.project_id === projectFilter);
  }, [leads, projectFilter]);

  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const won = filteredLeads.filter((l) => l.stage === 'Won');
    const lost = filteredLeads.filter((l) => l.stage === 'Lost');
    const active = filteredLeads.filter((l) => !['Won', 'Lost'].includes(l.stage));
    const tokenReceived = filteredLeads.filter((l) => l.stage === 'Token Received').length;
    const totalToken = filteredLeads
      .filter((l) => l.token_amount)
      .reduce((sum, l) => sum + (l.token_amount || 0), 0);
    const followUpsToday = filteredLeads.filter((l) => {
      if (!l.next_followup_at) return false;
      const d = new Date(l.next_followup_at);
      return d.toDateString() === new Date().toDateString();
    });
    const conversionRate = total > 0 ? ((won.length / total) * 100).toFixed(1) : '0.0';
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

    // Missed follow-ups: past due, not Won/Lost
    const missedFollowUps = filteredLeads.filter((l) => {
      if (!l.next_followup_at || ['Won', 'Lost'].includes(l.stage)) return false;
      return new Date(l.next_followup_at).getTime() < Date.now();
    });

    // Unassigned new leads
    const unassignedLeads = filteredLeads.filter((l) => !l.assigned_to && l.stage === 'New');

    return {
      total, won: won.length, lost: lost.length, active: active.length,
      tokenReceived, totalToken, followUpsToday, conversionRate,
      avgDaysToWin, avgDaysToLoss, agedLeads,
      missedFollowUps, unassignedLeads,
    };
  }, [filteredLeads]);

  const stageBreakdown = useMemo(() => {
    return LEAD_STAGES.map((stage) => ({
      stage,
      count: filteredLeads.filter((l) => l.stage === stage).length,
    }));
  }, [filteredLeads]);

  const followUpLeadsToday = useMemo(() => {
    return filteredLeads
      .filter((l) => {
        if (!l.next_followup_at) return false;
        const d = new Date(l.next_followup_at);
        return d.toDateString() === new Date().toDateString() && !['Won', 'Lost'].includes(l.stage);
      })
      .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime());
  }, [filteredLeads]);

  const upcomingFollowUps = useMemo(() => {
    return filteredLeads
      .filter((l) => l.next_followup_at && !['Won', 'Lost'].includes(l.stage))
      .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime())
      .slice(0, 5);
  }, [filteredLeads]);

  const recentLeads = useMemo(() => {
    return [...filteredLeads]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [filteredLeads]);

  const cardLeads = useMemo(() => {
    if (selectedCard === 'followups') return followUpLeadsToday;
    if (selectedCard === 'missed') return stats.missedFollowUps;
    if (selectedCard === 'unassigned') return stats.unassignedLeads;
    if (selectedCard === 'won') return filteredLeads.filter((l) => l.stage === 'Won');
    if (selectedCard === 'total') return filteredLeads;
    if (selectedCard === 'token') return filteredLeads.filter((l) => l.token_amount);
    if (selectedCard === 'aged') return filteredLeads.filter((l) => {
      const aging = getLeadAging(l.created_at, l.stage);
      return aging && aging.days > 15;
    });
    return [];
  }, [selectedCard, filteredLeads, followUpLeadsToday, stats.missedFollowUps, stats.unassignedLeads]);

  const handleInteraction = (lead: Lead, type: InteractionType) => {
    setLogLead(lead);
    setInteractionType(type);
  };

  const handleCallClick = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    window.open(telLink(lead.phone), '_self');
    handleInteraction(lead, 'call');
  };

  const handleWhatsAppClick = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    window.open(whatsappLink(lead.phone), '_blank', 'noopener,noreferrer');
    handleInteraction(lead, 'whatsapp');
  };

  const agentName = (id: string | null) => {
    if (!id) return 'Unassigned';
    const u = agents.find((a) => a.id === id);
    return u?.full_name || u?.username || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting}, {user?.full_name?.split(' ')[0] || user?.username}!
          </h1>
          <p className="text-slate-400 mt-1">
            {isAgent
              ? "Here's your pipeline at a glance"
              : isManager
              ? "Here's how your team is performing"
              : "Company-wide sales overview"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateFilter
            preset={datePreset}
            range={customRange}
            onPresetChange={(p) => { setDatePreset(p); setLoading(true); }}
            onCustomRangeChange={(r) => { setCustomRange(r); setLoading(true); }}
          />
          {/* Project filter */}
          {projects.length > 0 && (
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="pl-9 pr-8 py-2.5 rounded-xl surface-dark text-slate-200 text-sm font-medium focus:border-[#D4AF37] outline-none transition appearance-none cursor-pointer"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          <button
            onClick={() => setShowInbound(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg border border-white/10 transition active:scale-95"
          >
            <PhoneIncoming size={20} />
            <span className="hidden sm:inline">Inbound Call</span>
          </button>
        </div>
      </div>

      {/* Stat cards — glassmorphism dark cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Total Leads"
          value={stats.total.toString()}
          icon={Briefcase}
          gradient="from-sky-500/20 to-blue-600/10"
          iconBg="bg-sky-500"
          trend={stats.active > 0 ? `${stats.active} active` : undefined}
          active={selectedCard === 'total'}
          onClick={() => setSelectedCard(selectedCard === 'total' ? null : 'total')}
        />
        <StatCard
          label="Won Deals"
          value={stats.won.toString()}
          icon={CheckCircle2}
          gradient="from-emerald-500/20 to-green-600/10"
          iconBg="bg-emerald-500"
          trend={`${stats.conversionRate}% conversion`}
          trendUp
          active={selectedCard === 'won'}
          onClick={() => setSelectedCard(selectedCard === 'won' ? null : 'won')}
        />
        <StatCard
          label="Token Amount"
          value={formatCurrency(stats.totalToken)}
          icon={DollarSign}
          gradient="from-[#D4AF37]/20 to-yellow-600/10"
          iconBg="bg-[#D4AF37]"
          trend={stats.tokenReceived > 0 ? `${stats.tokenReceived} pending` : undefined}
          active={selectedCard === 'token'}
          onClick={() => setSelectedCard(selectedCard === 'token' ? null : 'token')}
        />
        <StatCard
          label="Follow-ups Today"
          value={stats.followUpsToday.length.toString()}
          icon={Clock}
          gradient="from-orange-500/20 to-red-600/10"
          iconBg="bg-orange-500"
          trend={stats.followUpsToday.length > 0 ? 'Action needed' : 'All clear'}
          trendUp={stats.followUpsToday.length === 0}
          active={selectedCard === 'followups'}
          onClick={() => setSelectedCard(selectedCard === 'followups' ? null : 'followups')}
        />
      </div>

      {/* Alert cards — Missed Follow-ups & Unassigned Leads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <StatCard
          label="Missed Follow-ups"
          value={stats.missedFollowUps.length.toString()}
          icon={AlertTriangle}
          gradient="from-red-500/20 to-rose-600/10"
          iconBg="bg-red-500"
          glow={stats.missedFollowUps.length > 0 ? 'red' : undefined}
          trend={stats.missedFollowUps.length > 0 ? 'Overdue — needs attention' : 'All follow-ups on track'}
          trendUp={stats.missedFollowUps.length === 0}
          active={selectedCard === 'missed'}
          onClick={() => stats.missedFollowUps.length > 0 && setSelectedCard(selectedCard === 'missed' ? null : 'missed')}
        />
        <StatCard
          label="Unassigned New Leads"
          value={stats.unassignedLeads.length.toString()}
          icon={UserX}
          gradient="from-amber-500/20 to-orange-600/10"
          iconBg="bg-amber-500"
          glow={stats.unassignedLeads.length > 0 ? 'amber' : undefined}
          trend={stats.unassignedLeads.length > 0 ? 'Assign agents now' : 'All leads assigned'}
          trendUp={stats.unassignedLeads.length === 0}
          active={selectedCard === 'unassigned'}
          onClick={() => stats.unassignedLeads.length > 0 && setSelectedCard(selectedCard === 'unassigned' ? null : 'unassigned')}
        />
      </div>

      {/* Closing Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <StatCard
          label="Avg Days to Win"
          value={`${stats.avgDaysToWin}d`}
          icon={TrendingUp}
          gradient="from-emerald-500/15 to-teal-600/10"
          iconBg="bg-emerald-500"
          trend={stats.won > 0 ? `${stats.won} won deals` : 'No wins yet'}
          trendUp
        />
        <StatCard
          label="Avg Days to Loss"
          value={`${stats.avgDaysToLoss}d`}
          icon={TrendingDown}
          gradient="from-rose-500/15 to-red-600/10"
          iconBg="bg-rose-500"
          trend={stats.lost > 0 ? `${stats.lost} lost deals` : 'No losses yet'}
        />
        <StatCard
          label="Aged Leads (>15d)"
          value={stats.agedLeads.toString()}
          icon={Hourglass}
          gradient="from-red-500/15 to-orange-600/10"
          iconBg="bg-red-500"
          trend={stats.agedLeads > 0 ? 'Needs attention' : 'All fresh'}
          active={selectedCard === 'aged'}
          onClick={() => setSelectedCard(selectedCard === 'aged' ? null : 'aged')}
        />
      </div>

      {/* Selected card leads list */}
      {selectedCard && (
        <div className="glass-card p-5 lg:p-6 animate-[fadeInUp_.2s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              {selectedCard === 'followups' && 'Follow-ups Today'}
              {selectedCard === 'missed' && 'Missed Follow-ups'}
              {selectedCard === 'unassigned' && 'Unassigned New Leads'}
              {selectedCard === 'won' && 'Won Deals'}
              {selectedCard === 'total' && 'All Leads'}
              {selectedCard === 'token' && 'Token Received Leads'}
              {selectedCard === 'aged' && 'Aged Leads (>15 Days)'}
              <span className="text-sm font-normal text-slate-500 ml-2">({cardLeads.length})</span>
            </h2>
            <button
              onClick={() => setSelectedCard(null)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {cardLeads.length === 0 ? (
              <p className="text-center py-8 text-slate-500 text-sm">No leads in this category</p>
            ) : (
              cardLeads.map((lead) => {
                const colors = STAGE_COLORS[lead.stage];
                const aging = getLeadAging(lead.created_at, lead.stage);
                const isMissed = selectedCard === 'missed';
                return (
                  <div
                    key={lead.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                      isMissed
                        ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 border border-white/10">
                      {lead.client_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{lead.client_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {lead.phone}
                        {lead.next_followup_at && (selectedCard === 'followups' || isMissed) && (
                          <span className={isMissed ? 'text-red-400 ml-1' : 'text-orange-400 ml-1'}>
                            · {formatDateTime(lead.next_followup_at)}
                          </span>
                        )}
                        {!isAgent && lead.assigned_to && (
                          <span className="text-slate-500 ml-1">· Agent: {agentName(lead.assigned_to)}</span>
                        )}
                        {!isAgent && !lead.assigned_to && (
                          <span className="text-amber-400 ml-1 font-medium">· Unassigned</span>
                        )}
                      </p>
                    </div>
                    {aging && (
                      <span className={`hidden sm:inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${AGING_COLORS[aging.level]}`}>
                        {aging.days}d
                      </span>
                    )}
                    <Badge className={`${colors.bg} ${colors.text} ${colors.border} border hidden sm:flex`}>
                      {lead.stage}
                    </Badge>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleWhatsAppClick(e, lead)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/80 hover:bg-green-500 text-white shadow-sm transition active:scale-95"
                        title="WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={(e) => handleCallClick(e, lead)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white shadow-sm transition active:scale-95"
                        title="Call"
                      >
                        <Phone size={14} />
                      </button>
                      <button
                        onClick={() => setQuickEditLead(lead)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition active:scale-95"
                        title="Quick Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Pipeline breakdown */}
        <div className="lg:col-span-2 glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">Pipeline Breakdown</h2>
            <button
              onClick={() => onNavigate('leads')}
              className="text-sm font-semibold text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {stageBreakdown.map(({ stage, count }) => {
              const colors = STAGE_COLORS[stage];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-32 lg:w-40 flex-shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                    <span className="text-sm font-medium text-slate-300">{stage}</span>
                  </div>
                  <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full ${colors.dot} transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    >
                      {count > 0 && (
                        <span className="text-[10px] font-bold text-white">{count}</span>
                      )}
                    </div>
                    {count === 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600">0</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming follow-ups */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">Follow-ups</h2>
            <Calendar size={18} className="text-slate-400" />
          </div>
          {upcomingFollowUps.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500/50" />
              <p className="text-sm">No upcoming follow-ups</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingFollowUps.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition cursor-pointer"
                  onClick={() => setQuickEditLead(lead)}
                >
                  <div className="w-9 h-9 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 border border-white/10">
                    {lead.client_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{lead.client_name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      {formatDateTime(lead.next_followup_at)}
                    </p>
                  </div>
                  <Badge className={`${STAGE_COLORS[lead.stage].bg} ${STAGE_COLORS[lead.stage].text} ${STAGE_COLORS[lead.stage].border} border`}>
                    {lead.stage}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity / Team performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent leads */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">Recent Activity</h2>
            <button
              onClick={() => onNavigate('leads')}
              className="text-sm font-semibold text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.05] transition border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 border border-white/10">
                  {lead.client_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{lead.client_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {lead.requirement || '—'} · {timeAgo(lead.updated_at)}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <Badge className={`${STAGE_COLORS[lead.stage].bg} ${STAGE_COLORS[lead.stage].text} ${STAGE_COLORS[lead.stage].border} border`}>
                    {lead.stage}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => handleWhatsAppClick(e, lead)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/80 hover:bg-green-500 text-white shadow-sm transition active:scale-95"
                    title="WhatsApp"
                  >
                    <MessageCircle size={14} />
                  </button>
                  <button
                    onClick={(e) => handleCallClick(e, lead)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white shadow-sm transition active:scale-95"
                    title="Call"
                  >
                    <Phone size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team performance with presence (admin/manager only) */}
        {!isAgent && (
          <div className="glass-card p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Team Performance</h2>
              <UsersIcon size={18} className="text-slate-400" />
            </div>
            <div className="space-y-3">
              {agents
                .filter((a) => a.role === 'agent' || a.role === 'manager')
                .map((agent) => {
                  const agentLeads = filteredLeads.filter((l) => l.assigned_to === agent.id);
                  const agentWon = agentLeads.filter((l) => l.stage === 'Won').length;
                  const agentActive = agentLeads.filter(
                    (l) => !['Won', 'Lost'].includes(l.stage)
                  ).length;
                  const agentMissed = agentLeads.filter((l) => {
                    if (!l.next_followup_at || ['Won', 'Lost'].includes(l.stage)) return false;
                    return new Date(l.next_followup_at).getTime() < Date.now();
                  }).length;
                  const presence = getPresence(agent.last_active_at);
                  return (
                    <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/[0.04] transition">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center text-sm font-bold">
                          {agent.full_name?.[0] || agent.username[0].toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${PRESENCE_COLORS[presence]} border-2 border-[#0B1120]`} title={PRESENCE_LABELS[presence]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {agent.full_name || agent.username}
                        </p>
                        <p className="text-xs text-slate-400">
                          {agentLeads.length} leads · {agentActive} active · {agentWon} won
                          {agentMissed > 0 && <span className="text-red-400 font-medium"> · {agentMissed} missed</span>}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        presence === 'online' ? 'bg-emerald-500/15 text-emerald-400' :
                        presence === 'idle' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-slate-500/15 text-slate-400'
                      }`}>
                        {PRESENCE_LABELS[presence]}
                      </span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{agentWon}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">won</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Agent quick stats (agent only) */}
        {isAgent && (
          <div className="glass-card p-5 lg:p-6 text-white">
            <h2 className="text-lg font-bold mb-5">Your Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <Target className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-slate-400">Active Leads</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <CheckCircle2 className="text-emerald-400 mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.won}</p>
                <p className="text-sm text-slate-400">Deals Won</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <Clock className="text-orange-400 mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.followUpsToday.length}</p>
                <p className="text-sm text-slate-400">Due Today</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <TrendingUp className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                <p className="text-sm text-slate-400">Win Rate</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Edit Drawer */}
      <QuickEditDrawer
        lead={quickEditLead}
        open={!!quickEditLead}
        projects={projects}
        onClose={() => setQuickEditLead(null)}
        onSaved={() => {
          setQuickEditLead(null);
          fetchData();
        }}
      />

      {/* Inbound Call Modal */}
      <InboundCallModal
        open={showInbound}
        users={agents}
        onClose={() => setShowInbound(false)}
        onCreated={() => {
          setShowInbound(false);
          fetchData();
        }}
      />

      {/* Log Interaction Modal */}
      <LogInteractionModal
        open={!!logLead}
        lead={logLead}
        interactionType={interactionType}
        onClose={() => setLogLead(null)}
        onLogged={() => {
          setLogLead(null);
          fetchData();
        }}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: typeof Briefcase;
  gradient: string;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
  active?: boolean;
  glow?: 'red' | 'amber' | 'green';
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, gradient, iconBg, trend, trendUp, active, glow, onClick }: StatCardProps) {
  const glowClass = glow === 'red' ? 'badge-glow-red' : glow === 'amber' ? 'badge-glow-amber' : glow === 'green' ? 'badge-glow-green' : '';
  return (
    <button
      onClick={onClick}
      className={`text-left stat-card-glass bg-gradient-to-br ${gradient} p-4 lg:p-5 ${
        active
          ? 'ring-2 ring-[#D4AF37]/40 border-[#D4AF37]/30'
          : ''
      } ${glowClass} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-xl ${iconBg} flex items-center justify-center text-white shadow-lg`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{label}</p>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
          trendUp ? 'text-emerald-400' : glow === 'red' ? 'text-red-400' : glow === 'amber' ? 'text-amber-400' : 'text-slate-400'
        }`}>
          {trendUp ? <ArrowUpRight size={12} /> : null}
          {trend}
        </div>
      )}
    </button>
  );
}
