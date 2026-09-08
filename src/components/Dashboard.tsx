import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, Users as UsersIcon, Target, Briefcase, Clock, ArrowUpRight,
  Calendar, CheckCircle2, PhoneIncoming, Phone, MessageCircle, Edit3, X,
  AlertTriangle, UserX, MapPin, ChevronDown, Zap, PhoneOutgoing, Flame,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import {
  Lead, User, Project, InteractionType,
  LEAD_STAGES, STAGE_COLORS,
  getPresence, PRESENCE_COLORS, PRESENCE_LABELS,
  getLeadAging, AGING_COLORS,
  DatePreset, DateRange, getPresetRange,
} from '@/lib/types';
import { formatCurrency, formatDateTime, timeAgo, telLink, whatsappLink } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import QuickEditDrawer from '@/components/QuickEditDrawer';
import InboundCallModal from '@/components/InboundCallModal';
import OutboundCallModal from '@/components/OutboundCallModal';
import LogInteractionModal from '@/components/LogInteractionModal';
import DateFilter from '@/components/ui/DateFilter';

interface DashboardProps {
  onNavigate: (page: 'leads' | 'analytics') => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, isManager, isAgent } = useAuth();
  const getVisibleAgentIds = useVisibleAgentIds();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null);
  const [showInbound, setShowInbound] = useState(false);
  const [showOutbound, setShowOutbound] = useState(false);
  const [logLead, setLogLead] = useState<Lead | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>('call');

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

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

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (projectFilter !== 'all') result = result.filter((l) => l.project_id === projectFilter);
    if (!isAgent && agentFilter !== 'all') result = result.filter((l) => l.assigned_to === agentFilter);
    return result;
  }, [leads, projectFilter, agentFilter, isAgent]);

  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const won = filteredLeads.filter((l) => l.stage === 'Won');
    const lost = filteredLeads.filter((l) => l.stage === 'Lost');
    const active = filteredLeads.filter((l) => !['Won', 'Lost'].includes(l.stage));
    const followUpsToday = filteredLeads.filter((l) => {
      if (!l.next_followup_at) return false;
      const d = new Date(l.next_followup_at);
      return d.toDateString() === new Date().toDateString();
    });
    const conversionRate = total > 0 ? ((won.length / total) * 100).toFixed(1) : '0.0';
    const missedFollowUps = filteredLeads.filter((l) => {
      if (!l.next_followup_at || ['Won', 'Lost'].includes(l.stage)) return false;
      return new Date(l.next_followup_at).getTime() < Date.now();
    });
    const unassignedLeads = filteredLeads.filter((l) => !l.assigned_to && l.stage === 'New');
    const totalToken = filteredLeads
      .filter((l) => l.token_amount)
      .reduce((sum, l) => sum + (l.token_amount || 0), 0);

    return {
      total, won: won.length, lost: lost.length, active: active.length,
      followUpsToday, conversionRate,
      missedFollowUps, unassignedLeads, totalToken,
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

  // Urgent queue items: missed follow-ups + unassigned, sorted by urgency
  const urgentItems = useMemo(() => {
    const missed = stats.missedFollowUps.map((l) => ({ ...l, urgentType: 'missed' as const }));
    const unassigned = stats.unassignedLeads.map((l) => ({ ...l, urgentType: 'unassigned' as const }));
    return [...missed, ...unassigned].sort((a, b) => {
      // Missed first, then by created_at
      if (a.urgentType !== b.urgentType) return a.urgentType === 'missed' ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [stats.missedFollowUps, stats.unassignedLeads]);

  const recentLeads = useMemo(() => {
    return [...filteredLeads]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [filteredLeads]);

  const cardLeads = useMemo(() => {
    if (selectedCard === 'followups') return followUpLeadsToday;
    if (selectedCard === 'missed') return stats.missedFollowUps;
    if (selectedCard === 'unassigned') return stats.unassignedLeads;
    if (selectedCard === 'active') return filteredLeads.filter((l) => !['Won', 'Lost'].includes(l.stage));
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">
            {greeting}, {user?.full_name?.split(' ')[0] || user?.username}!
          </h1>
          <p className="text-slate-500 mt-1">
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
          {/* Agent filter */}
          {!isAgent && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl surface-dark text-slate-700 text-sm font-medium focus:border-[#D4AF37] outline-none transition cursor-pointer"
            >
              <option value="all">All Agents</option>
              {agents.filter((a) => a.role === 'agent' || a.role === 'manager').map((a) => (
                <option key={a.id} value={a.id}>{a.full_name || a.username}</option>
              ))}
            </select>
          )}
          {/* Project filter */}
          {projects.length > 0 && (
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="pl-9 pr-8 py-2.5 rounded-xl surface-dark text-slate-700 text-sm font-medium focus:border-[#D4AF37] outline-none transition appearance-none cursor-pointer"
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-md transition active:scale-95"
          >
            <PhoneIncoming size={20} />
            <span className="hidden sm:inline">Inbound Call</span>
          </button>
          <button
            onClick={() => setShowOutbound(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c4a030] text-[#1E293B] font-semibold shadow-md transition active:scale-95"
          >
            <PhoneOutgoing size={20} />
            <span className="hidden sm:inline">Outbound Call</span>
          </button>
        </div>
      </div>

      {/* 4 high-value stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Active Leads"
          value={stats.active.toString()}
          icon={Briefcase}
          iconBg="bg-sky-500"
          trend={`${stats.total} total · ${stats.conversionRate}% win rate`}
          active={selectedCard === 'active'}
          onClick={() => setSelectedCard(selectedCard === 'active' ? null : 'active')}
        />
        <StatCard
          label="Follow-ups Today"
          value={stats.followUpsToday.length.toString()}
          icon={Clock}
          iconBg="bg-orange-500"
          trend={stats.followUpsToday.length > 0 ? 'Action needed today' : 'All clear'}
          trendUp={stats.followUpsToday.length === 0}
          active={selectedCard === 'followups'}
          onClick={() => setSelectedCard(selectedCard === 'followups' ? null : 'followups')}
        />
        <StatCard
          label="Missed Follow-ups"
          value={stats.missedFollowUps.length.toString()}
          icon={AlertTriangle}
          iconBg="bg-red-500"
          glow={stats.missedFollowUps.length > 0 ? 'red' : undefined}
          trend={stats.missedFollowUps.length > 0 ? 'Overdue — needs attention' : 'All on track'}
          trendUp={stats.missedFollowUps.length === 0}
          active={selectedCard === 'missed'}
          onClick={() => stats.missedFollowUps.length > 0 && setSelectedCard(selectedCard === 'missed' ? null : 'missed')}
        />
        <StatCard
          label="Unassigned New Leads"
          value={stats.unassignedLeads.length.toString()}
          icon={UserX}
          iconBg="bg-amber-500"
          glow={stats.unassignedLeads.length > 0 ? 'amber' : undefined}
          trend={stats.unassignedLeads.length > 0 ? 'Assign agents now' : 'All assigned'}
          trendUp={stats.unassignedLeads.length === 0}
          active={selectedCard === 'unassigned'}
          onClick={() => stats.unassignedLeads.length > 0 && setSelectedCard(selectedCard === 'unassigned' ? null : 'unassigned')}
        />
      </div>

      {/* Selected card leads list */}
      {selectedCard && (
        <div className="glass-card p-5 lg:p-6 animate-[fadeInUp_.2s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#0F172A]">
              {selectedCard === 'followups' && 'Follow-ups Today'}
              {selectedCard === 'missed' && 'Missed Follow-ups'}
              {selectedCard === 'unassigned' && 'Unassigned New Leads'}
              {selectedCard === 'active' && 'Active Leads'}
              <span className="text-sm font-normal text-slate-400 ml-2">({cardLeads.length})</span>
            </h2>
            <button
              onClick={() => setSelectedCard(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {cardLeads.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No leads in this category</p>
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
                        ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {lead.client_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{lead.client_name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {lead.phone}
                        {lead.next_followup_at && (selectedCard === 'followups' || isMissed) && (
                          <span className={isMissed ? 'text-red-600 ml-1 font-medium' : 'text-orange-600 ml-1'}>
                            · {formatDateTime(lead.next_followup_at)}
                          </span>
                        )}
                        {!isAgent && lead.assigned_to && (
                          <span className="ml-1">· <span className="font-bold text-slate-700">{agentName(lead.assigned_to)}</span></span>
                        )}
                        {!isAgent && !lead.assigned_to && (
                          <span className="text-amber-600 ml-1 font-bold">· Unassigned</span>
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

      {/* Priority Action Center — split view */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Left Panel (60%): Urgent Action Queue */}
        <div className="lg:col-span-3 glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <Flame size={18} className="text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A]">Urgent Action Queue</h2>
            </div>
            <span className="text-xs font-bold text-white bg-red-500 px-2.5 py-1 rounded-full">
              {urgentItems.length} items
            </span>
          </div>

          {urgentItems.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500/50" />
              <p className="text-sm text-slate-500 font-medium">All caught up!</p>
              <p className="text-xs text-slate-400 mt-0.5">No missed follow-ups or unassigned leads</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {urgentItems.slice(0, 12).map((item) => {
                const colors = STAGE_COLORS[item.stage];
                const isMissed = item.urgentType === 'missed';
                const overdueMs = item.next_followup_at
                  ? Date.now() - new Date(item.next_followup_at).getTime()
                  : 0;
                const overdueHours = Math.floor(overdueMs / 3600000);
                const overdueDays = Math.floor(overdueHours / 24);
                const overdueText = overdueDays > 0
                  ? `${overdueDays}d overdue`
                  : overdueHours > 0
                  ? `${overdueHours}h overdue`
                  : 'Overdue';

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                      isMissed
                        ? 'border-red-200 bg-red-50/40 hover:bg-red-50'
                        : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50'
                    }`}
                  >
                    {/* Urgency indicator */}
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isMissed ? 'bg-red-500' : 'bg-amber-500'}`} />

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {item.client_name[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{item.client_name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isAgent && (
                          <span className={`text-xs font-bold ${item.assigned_to ? 'text-slate-700' : 'text-amber-600'}`}>
                            {agentName(item.assigned_to)}
                          </span>
                        )}
                        {isMissed ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            {overdueText}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                            Needs assignment
                          </span>
                        )}
                        <Badge className={`${colors.bg} ${colors.text} ${colors.border} border`}>
                          {item.stage}
                        </Badge>
                      </div>
                    </div>

                    {/* 1-click actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleWhatsAppClick(e, item)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-sm transition active:scale-95"
                        title="WhatsApp"
                      >
                        <MessageCircle size={15} />
                      </button>
                      <button
                        onClick={(e) => handleCallClick(e, item)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition active:scale-95"
                        title="Direct Call"
                      >
                        <Phone size={15} />
                      </button>
                      <button
                        onClick={() => setQuickEditLead(item)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition active:scale-95"
                        title="Quick Edit"
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {urgentItems.length > 12 && (
                <button
                  onClick={() => onNavigate('leads')}
                  className="w-full text-center py-2 text-sm font-semibold text-[#D4AF37] hover:underline"
                >
                  View all {urgentItems.length} urgent items →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Panel (40%): Pipeline Summary + Quick Dialer */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pipeline Summary */}
          <div className="glass-card p-5">
            <h2 className="text-lg font-bold text-[#0F172A] mb-4">Pipeline Summary</h2>
            <div className="space-y-2.5">
              {stageBreakdown.map(({ stage, count }) => {
                const colors = STAGE_COLORS[stage];
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={stage} className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className="text-xs font-medium text-slate-600 truncate">{stage}</span>
                    </div>
                    <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full ${colors.dot} transition-all duration-500 flex items-center justify-end pr-1.5`}
                        style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                      >
                        {count > 0 && <span className="text-[9px] font-bold text-white">{count}</span>}
                      </div>
                      {count === 0 && (
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">0</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-[#0F172A]">{stats.total}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{stats.won}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Won</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#D4AF37]">{formatCurrency(stats.totalToken)}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Token</p>
              </div>
            </div>
          </div>

          {/* Quick Dialer */}
          <div className="glass-card p-5">
            <h2 className="text-base font-bold text-[#0F172A] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowInbound(true)}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-sm transition"
              >
                <PhoneIncoming size={22} />
                Inbound Call
              </button>
              <button
                onClick={() => onNavigate('leads')}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold text-sm transition"
              >
                <PhoneOutgoing size={22} />
                Make Calls
              </button>
            </div>
            {/* Today's follow-up count badge */}
            {stats.followUpsToday.length > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-200">
                <Zap size={16} className="text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-700 font-medium">
                  <span className="font-bold">{stats.followUpsToday.length}</span> follow-up{stats.followUpsToday.length > 1 ? 's' : ''} due today
                </p>
                <button
                  onClick={() => setSelectedCard('followups')}
                  className="ml-auto text-xs font-bold text-orange-600 hover:underline"
                >
                  View
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity / Team performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent leads */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[#0F172A]">Recent Activity</h2>
            <button
              onClick={() => onNavigate('leads')}
              className="text-sm font-semibold text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {lead.client_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{lead.client_name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {lead.requirement || '—'} · {timeAgo(lead.updated_at)}
                    {!isAgent && lead.assigned_to && (
                      <span className="ml-1">· <span className="font-bold text-slate-700">{agentName(lead.assigned_to)}</span></span>
                    )}
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
            ))}
          </div>
        </div>

        {/* Team performance (admin/manager only) */}
        {!isAgent && (
          <div className="glass-card p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#0F172A]">Team Performance</h2>
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
                    <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 text-[#a67c00] flex items-center justify-center text-sm font-bold">
                          {agent.full_name?.[0] || agent.username[0].toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${PRESENCE_COLORS[presence]} border-2 border-white`} title={PRESENCE_LABELS[presence]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0F172A] truncate">
                          {agent.full_name || agent.username}
                        </p>
                        <p className="text-xs text-slate-500">
                          {agentLeads.length} leads · {agentActive} active · {agentWon} won
                          {agentMissed > 0 && <span className="text-red-600 font-bold"> · {agentMissed} missed</span>}
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
                        <p className="text-lg font-bold text-[#0F172A]">{agentWon}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">won</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Agent quick stats (agent only) */}
        {isAgent && (
          <div className="glass-card p-5 lg:p-6">
            <h2 className="text-lg font-bold text-[#0F172A] mb-5">Your Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <Target className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold text-[#0F172A]">{stats.active}</p>
                <p className="text-sm text-slate-500">Active Leads</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <CheckCircle2 className="text-emerald-500 mb-2" size={22} />
                <p className="text-2xl font-bold text-[#0F172A]">{stats.won}</p>
                <p className="text-sm text-slate-500">Deals Won</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <Clock className="text-orange-500 mb-2" size={22} />
                <p className="text-2xl font-bold text-[#0F172A]">{stats.followUpsToday.length}</p>
                <p className="text-sm text-slate-500">Due Today</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <TrendingUp className="text-[#D4AF37] mb-2" size={22} />
                <p className="text-2xl font-bold text-[#0F172A]">{stats.conversionRate}%</p>
                <p className="text-sm text-slate-500">Win Rate</p>
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
        onSaved={() => { setQuickEditLead(null); fetchData(); }}
      />

      {/* Inbound Call Modal */}
      <InboundCallModal
        open={showInbound}
        users={agents}
        onClose={() => setShowInbound(false)}
        onCreated={() => { setShowInbound(false); fetchData(); }}
      />

      {/* Outbound Call Modal */}
      <OutboundCallModal
        open={showOutbound}
        onClose={() => setShowOutbound(false)}
        onLogged={() => { setShowOutbound(false); fetchData(); }}
      />

      {/* Log Interaction Modal */}
      <LogInteractionModal
        open={!!logLead}
        lead={logLead}
        interactionType={interactionType}
        onClose={() => setLogLead(null)}
        onLogged={() => { setLogLead(null); fetchData(); }}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: typeof Briefcase;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
  active?: boolean;
  glow?: 'red' | 'amber' | 'green';
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, iconBg, trend, trendUp, active, glow, onClick }: StatCardProps) {
  const glowClass = glow === 'red' ? 'badge-glow-red' : glow === 'amber' ? 'badge-glow-amber' : glow === 'green' ? 'badge-glow-green' : '';
  return (
    <button
      onClick={onClick}
      className={`text-left stat-card-glass p-4 lg:p-5 ${
        active ? 'ring-2 ring-[#D4AF37]/40 border-[#D4AF37]/30' : ''
      } ${glowClass} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-xl ${iconBg} flex items-center justify-center text-white shadow-md`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-[#0F172A]">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
          trendUp ? 'text-emerald-600' : glow === 'red' ? 'text-red-600' : glow === 'amber' ? 'text-amber-600' : 'text-slate-500'
        }`}>
          {trendUp ? <ArrowUpRight size={12} /> : null}
          {trend}
        </div>
      )}
    </button>
  );
}
