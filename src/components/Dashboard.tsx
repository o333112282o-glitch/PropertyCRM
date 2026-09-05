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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import {
  Lead,
  User,
  Project,
  InteractionType,
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

  const stats = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((l) => l.stage === 'Won');
    const lost = leads.filter((l) => l.stage === 'Lost');
    const active = leads.filter((l) => !['Won', 'Lost'].includes(l.stage));
    const tokenReceived = leads.filter((l) => l.stage === 'Token Received').length;
    const totalToken = leads
      .filter((l) => l.token_amount)
      .reduce((sum, l) => sum + (l.token_amount || 0), 0);
    const followUpsToday = leads.filter((l) => {
      if (!l.next_followup_at) return false;
      const d = new Date(l.next_followup_at);
      return d.toDateString() === new Date().toDateString();
    });
    const conversionRate = total > 0 ? ((won.length / total) * 100).toFixed(1) : '0.0';

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

    return {
      total, won: won.length, lost: lost.length, active: active.length,
      tokenReceived, totalToken, followUpsToday, conversionRate,
      avgDaysToWin, avgDaysToLoss, agedLeads,
    };
  }, [leads]);

  const stageBreakdown = useMemo(() => {
    return LEAD_STAGES.map((stage) => ({
      stage,
      count: leads.filter((l) => l.stage === stage).length,
    }));
  }, [leads]);

  const followUpLeadsToday = useMemo(() => {
    return leads
      .filter((l) => {
        if (!l.next_followup_at) return false;
        const d = new Date(l.next_followup_at);
        return d.toDateString() === new Date().toDateString() && !['Won', 'Lost'].includes(l.stage);
      })
      .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime());
  }, [leads]);

  const upcomingFollowUps = useMemo(() => {
    return leads
      .filter((l) => l.next_followup_at && !['Won', 'Lost'].includes(l.stage))
      .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime())
      .slice(0, 5);
  }, [leads]);

  const recentLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [leads]);

  const cardLeads = useMemo(() => {
    if (selectedCard === 'followups') return followUpLeadsToday;
    if (selectedCard === 'won') return leads.filter((l) => l.stage === 'Won');
    if (selectedCard === 'total') return leads;
    if (selectedCard === 'token') return leads.filter((l) => l.token_amount);
    if (selectedCard === 'aged') return leads.filter((l) => {
      const aging = getLeadAging(l.created_at, l.stage);
      return aging && aging.days > 15;
    });
    return [];
  }, [selectedCard, leads, followUpLeadsToday]);

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
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {user?.full_name?.split(' ')[0] || user?.username}!
          </h1>
          <p className="text-gray-500 mt-1">
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
          <button
            onClick={() => setShowInbound(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-95"
          >
            <PhoneIncoming size={20} />
            <span className="hidden sm:inline">Inbound Call</span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Total Leads"
          value={stats.total.toString()}
          icon={Briefcase}
          color="bg-sky-500"
          trend={stats.active > 0 ? `${stats.active} active` : undefined}
          active={selectedCard === 'total'}
          onClick={() => setSelectedCard(selectedCard === 'total' ? null : 'total')}
        />
        <StatCard
          label="Won Deals"
          value={stats.won.toString()}
          icon={CheckCircle2}
          color="bg-[#D4AF37]"
          trend={`${stats.conversionRate}% conversion`}
          trendUp
          active={selectedCard === 'won'}
          onClick={() => setSelectedCard(selectedCard === 'won' ? null : 'won')}
        />
        <StatCard
          label="Token Amount"
          value={formatCurrency(stats.totalToken)}
          icon={DollarSign}
          color="bg-[#D4AF37]"
          trend={stats.tokenReceived > 0 ? `${stats.tokenReceived} pending` : undefined}
          active={selectedCard === 'token'}
          onClick={() => setSelectedCard(selectedCard === 'token' ? null : 'token')}
        />
        <StatCard
          label="Follow-ups Today"
          value={stats.followUpsToday.length.toString()}
          icon={Clock}
          color="bg-[#F97316]"
          trend={stats.followUpsToday.length > 0 ? 'Action needed' : 'All clear'}
          trendUp={stats.followUpsToday.length === 0}
          active={selectedCard === 'followups'}
          onClick={() => setSelectedCard(selectedCard === 'followups' ? null : 'followups')}
        />
      </div>

      {/* Closing Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <StatCard
          label="Avg Days to Win"
          value={`${stats.avgDaysToWin}d`}
          icon={TrendingUp}
          color="bg-emerald-500"
          trend={stats.won > 0 ? `${stats.won} won deals` : 'No wins yet'}
          trendUp
        />
        <StatCard
          label="Avg Days to Loss"
          value={`${stats.avgDaysToLoss}d`}
          icon={TrendingDown}
          color="bg-rose-500"
          trend={stats.lost > 0 ? `${stats.lost} lost deals` : 'No losses yet'}
        />
        <StatCard
          label="Aged Leads (>15d)"
          value={stats.agedLeads.toString()}
          icon={Hourglass}
          color="bg-red-500"
          trend={stats.agedLeads > 0 ? 'Needs attention' : 'All fresh'}
          active={selectedCard === 'aged'}
          onClick={() => setSelectedCard(selectedCard === 'aged' ? null : 'aged')}
        />
      </div>

      {/* Selected card leads list */}
      {selectedCard && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 animate-[fadeIn_.2s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {selectedCard === 'followups' && 'Follow-ups Today'}
              {selectedCard === 'won' && 'Won Deals'}
              {selectedCard === 'total' && 'All Leads'}
              {selectedCard === 'token' && 'Token Received Leads'}
              {selectedCard === 'aged' && 'Aged Leads (>15 Days)'}
              <span className="text-sm font-normal text-gray-400 ml-2">({cardLeads.length})</span>
            </h2>
            <button
              onClick={() => setSelectedCard(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {cardLeads.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">No leads in this category</p>
            ) : (
              cardLeads.map((lead) => {
                const colors = STAGE_COLORS[lead.stage];
                const aging = getLeadAging(lead.created_at, lead.stage);
                return (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {lead.client_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{lead.client_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {lead.phone}
                        {lead.next_followup_at && selectedCard === 'followups' && (
                          <span className="text-[#F97316] ml-1">· {formatDateTime(lead.next_followup_at)}</span>
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
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-sm transition active:scale-95"
                        title="WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={(e) => handleCallClick(e, lead)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition active:scale-95"
                        title="Call"
                      >
                        <Phone size={14} />
                      </button>
                      <button
                        onClick={() => setQuickEditLead(lead)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition active:scale-95"
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
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Pipeline Breakdown</h2>
            <button
              onClick={() => onNavigate('leads')}
              className="text-sm font-semibold text-[#F97316] hover:underline flex items-center gap-1"
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
                    <span className="text-sm font-medium text-gray-700">{stage}</span>
                  </div>
                  <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full ${colors.dot} transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    >
                      {count > 0 && (
                        <span className="text-[10px] font-bold text-white">{count}</span>
                      )}
                    </div>
                    {count === 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">0</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming follow-ups */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Follow-ups</h2>
            <Calendar size={18} className="text-gray-400" />
          </div>
          {upcomingFollowUps.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-[#D4AF37]" />
              <p className="text-sm">No upcoming follow-ups</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingFollowUps.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                  onClick={() => setQuickEditLead(lead)}
                >
                  <div className="w-9 h-9 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {lead.client_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.client_name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
            <button
              onClick={() => onNavigate('leads')}
              className="text-sm font-semibold text-[#F97316] hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {recentLeads.map((lead) => {
              const agent = agents.find((a) => a.id === lead.assigned_to);
              return (
                <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {lead.client_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.client_name}</p>
                    <p className="text-xs text-gray-500 truncate">
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
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-sm transition active:scale-95"
                      title="WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <button
                      onClick={(e) => handleCallClick(e, lead)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition active:scale-95"
                      title="Call"
                    >
                      <Phone size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team performance with presence (admin/manager only) */}
        {!isAgent && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Team Performance</h2>
              <UsersIcon size={18} className="text-gray-400" />
            </div>
            <div className="space-y-3">
              {agents
                .filter((a) => a.role === 'agent' || a.role === 'manager')
                .map((agent) => {
                  const agentLeads = leads.filter((l) => l.assigned_to === agent.id);
                  const agentWon = agentLeads.filter((l) => l.stage === 'Won').length;
                  const agentActive = agentLeads.filter(
                    (l) => !['Won', 'Lost'].includes(l.stage)
                  ).length;
                  const presence = getPresence(agent.last_active_at);
                  return (
                    <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border-slate-100 hover:bg-slate-50 transition">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center text-sm font-bold">
                          {agent.full_name?.[0] || agent.username[0].toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${PRESENCE_COLORS[presence]} border-2 border-white`} title={PRESENCE_LABELS[presence]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {agent.full_name || agent.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agentLeads.length} leads · {agentActive} active · {agentWon} won
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        presence === 'online' ? 'bg-emerald-50 text-emerald-600' :
                        presence === 'idle' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {PRESENCE_LABELS[presence]}
                      </span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{agentWon}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">won</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Agent quick stats (agent only) */}
        {isAgent && (
          <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] rounded-2xl p-5 lg:p-6 text-white">
            <h2 className="text-lg font-bold mb-5">Your Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-xl p-4">
                <Target className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-white/60">Active Leads</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <CheckCircle2 className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.won}</p>
                <p className="text-sm text-white/60">Deals Won</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <Clock className="text-[#F97316] mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.followUpsToday.length}</p>
                <p className="text-sm text-white/60">Due Today</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <TrendingUp className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                <p className="text-sm text-white/60">Win Rate</p>
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

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: typeof Briefcase;
  color: string;
  trend?: string;
  trendUp?: boolean;
  active?: boolean;
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, color, trend, trendUp, active, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border p-4 lg:p-5 transition-all ${
        active
          ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/20 shadow-md'
          : 'border-slate-200 hover:shadow-md hover:border-slate-300'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-xl ${color} flex items-center justify-center text-white shadow-sm`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
          trendUp ? 'text-[#D4AF37]' : 'text-gray-500'
        }`}>
          {trendUp ? <ArrowUpRight size={12} /> : null}
          {trend}
        </div>
      )}
    </button>
  );
}
