import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Search, Briefcase, Grid3x3, List, Trash2, Edit2, Tag, History, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useVisibleAgentIds } from '@/lib/auth';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import {
  Lead,
  LeadStage,
  User,
  Project,
  InteractionType,
  LEAD_STAGES,
  STAGE_COLORS,
  getLeadAging,
  AGING_COLORS,
} from '@/lib/types';
import { formatDate, formatDateTime, formatCurrency, timeAgo } from '@/lib/utils';
import ActionButtons from '@/components/ui/ActionButtons';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LeadForm from '@/components/LeadForm';
import LogInteractionModal from '@/components/LogInteractionModal';
import ActivityTimeline from '@/components/ActivityTimeline';

interface LeadsProps {
  deepLinkLeadId?: string | null;
  onDeepLinkConsumed?: () => void;
}

export default function Leads({ deepLinkLeadId, onDeepLinkConsumed }: LeadsProps) {
  const { user, isAgent, isSuperAdmin, isManager, canDelete } = useAuth();
  const getVisibleAgentIds = useVisibleAgentIds();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
  const [logLead, setLogLead] = useState<Lead | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>('call');
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailTab, setDetailTab] = useState<'edit' | 'activity'>('edit');
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

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
    const { data: leadData } = await query.order('updated_at', { ascending: false });
    setLeads((leadData as Lead[]) || []);

    let userQuery = supabase.from('users').select('*');
    if (isManager && getVisibleAgentIds) {
      const agentIds = await getVisibleAgentIds();
      if (agentIds) userQuery = userQuery.in('id', agentIds);
    }
    const { data: userData } = await userQuery.order('full_name');
    setUsers((userData as User[]) || []);

    const { data: projData } = await supabase.from('projects').select('*');
    setProjects((projData as Project[]) || []);

    setLoading(false);
  }, [user, isAgent, isManager, getVisibleAgentIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDebouncedRealtimeLeads(fetchData);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
      if (agentFilter !== 'all' && l.assigned_to !== agentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.client_name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.requirement?.toLowerCase().includes(q) ?? false) ||
          (l.budget_range?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [leads, stageFilter, agentFilter, search]);

  const kanbanData = useMemo(() => {
    return LEAD_STAGES.map((stage) => ({
      stage,
      leads: filteredLeads.filter((l) => l.stage === stage),
    }));
  }, [filteredLeads]);

  // Handle deep-link from PWA push notification
  useEffect(() => {
    if (deepLinkLeadId) {
      const lead = leads.find((l) => l.id === deepLinkLeadId);
      if (lead) {
        handleViewDetails(lead);
        onDeepLinkConsumed?.();
      } else if (!loading) {
        onDeepLinkConsumed?.();
      }
    }
  }, [deepLinkLeadId, leads, loading, onDeepLinkConsumed]);

  const handleAdd = () => {
    setEditingLead(null);
    setDetailLead(null);
    setDetailTab('edit');
    setShowForm(true);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setDetailLead(lead);
    setDetailTab('edit');
    setShowForm(true);
  };

  const handleViewDetails = (lead: Lead) => {
    setDetailLead(lead);
    setEditingLead(lead);
    setDetailTab('activity');
    setShowForm(true);
  };

  const handleInteraction = (lead: Lead, type: InteractionType) => {
    setLogLead(lead);
    setInteractionType(type);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from('activity_logs').delete().eq('lead_id', confirmDelete.id);
    await supabase.from('leads').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    fetchData();
  };

  const handleReassign = async (lead: Lead, newAgentId: string) => {
    await supabase.from('leads').update({ assigned_to: newAgentId || null }).eq('id', lead.id);
    await supabase.from('activity_logs').insert({
      lead_id: lead.id,
      user_id: user?.id,
      action: 'Lead Reassigned',
      detail: `Assigned to ${users.find((u) => u.id === newAgentId)?.full_name || 'Unassigned'}`,
    });
    fetchData();
  };

  const agentName = (id: string | null) => {
    if (!id) return 'Unassigned';
    const u = users.find((u) => u.id === id);
    return u?.full_name || u?.username || 'Unknown';
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Pipeline</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'}
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-95"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Lead</span>
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, requirement..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as LeadStage | 'all')}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 text-sm font-medium focus:border-[#D4AF37] outline-none transition"
          >
            <option value="all">All Stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {!isAgent && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 text-sm font-medium focus:border-[#D4AF37] outline-none transition"
            >
              <option value="all">All Agents</option>
              {users.filter((u) => u.role === 'agent' || u.role === 'manager').map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </option>
              ))}
            </select>
          )}

          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2.5 transition ${view === 'list' ? 'bg-[#1E293B] text-white' : 'bg-white text-gray-400 hover:bg-slate-50'}`}
              title="List view"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-2.5 transition ${view === 'kanban' ? 'bg-[#1E293B] text-white' : 'bg-white text-gray-400 hover:bg-slate-50'}`}
              title="Kanban view"
            >
              <Grid3x3 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-2.5">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No leads found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new lead</p>
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const colors = STAGE_COLORS[lead.stage];
              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition group"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-[#1E293B] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {lead.client_name[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{lead.client_name}</h3>
                            {(lead.source_dealer_id || lead.lead_source === 'Dealer Sourced') && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F97316] bg-[#F97316]/10 px-1.5 py-0.5 rounded flex-shrink-0">
                                <Tag size={9} /> Dealer Sourced
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {lead.requirement || 'No requirement specified'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {(() => {
                            const aging = getLeadAging(lead.created_at, lead.stage);
                            return aging ? (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${AGING_COLORS[aging.level]}`}>
                                {aging.days}d
                              </span>
                            ) : null;
                          })()}
                          <Badge className={`${colors.bg} ${colors.text} ${colors.border} border`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {lead.stage}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span className="font-medium">{lead.phone}</span>
                        {lead.budget_range && <span>{lead.budget_range}</span>}
                        {!isAgent && (
                          <span className="text-gray-400">
                            Agent: <span className="text-gray-600 font-medium">{agentName(lead.assigned_to)}</span>
                          </span>
                        )}
                        {lead.next_followup_at && !['Won', 'Lost'].includes(lead.stage) && (
                          <span className="text-[#F97316] font-medium flex items-center gap-1">
                            Follow-up: {formatDateTime(lead.next_followup_at)}
                          </span>
                        )}
                        {lead.token_amount && (
                          <span className="text-[#D4AF37] font-semibold">{formatCurrency(lead.token_amount)} token</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {!isAgent && (
                        <div className="relative">
                          <select
                            value={lead.assigned_to || ''}
                            onChange={(e) => handleReassign(lead, e.target.value)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-medium focus:border-[#D4AF37] outline-none transition cursor-pointer"
                            title="Reassign lead"
                          >
                            <option value="">Unassigned</option>
                            {users.filter((u) => u.role === 'agent' || u.role === 'manager').map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name || u.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {isAgent && (
                        <span className="text-xs text-gray-400">Updated {timeAgo(lead.updated_at)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(lead)}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition"
                        title="Activity History"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => handleEdit(lead)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setConfirmDelete(lead)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <ActionButtons phone={lead.phone} size="sm" onInteraction={(type) => handleInteraction(lead, type)} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="overflow-x-auto -mx-4 px-4 pb-4">
          <div className="flex gap-3 min-w-max">
            {kanbanData.map(({ stage, leads: stageLeads }) => {
              const colors = STAGE_COLORS[stage];
              return (
                <div key={stage} className="w-72 flex-shrink-0">
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${colors.bg} ${colors.border} border mb-3`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                      <span className={`text-sm font-bold ${colors.text}`}>{stage}</span>
                    </div>
                    <span className={`text-xs font-bold ${colors.text} bg-white/60 px-2 py-0.5 rounded-full`}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="space-y-2.5 min-h-[100px]">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 hover:shadow-md transition cursor-pointer"
                        onClick={() => handleViewDetails(lead)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-semibold text-sm text-gray-900 truncate">{lead.client_name}</h4>
                              {(lead.source_dealer_id || lead.lead_source === 'Dealer Sourced') && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#F97316] bg-[#F97316]/10 px-1 py-0.5 rounded flex-shrink-0">
                                  <Tag size={8} /> Dealer
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{lead.requirement || '—'}</p>
                          </div>
                        </div>
                        {lead.budget_range && (
                          <p className="text-xs text-gray-600 font-medium mb-2">{lead.budget_range}</p>
                        )}
                        {!isAgent && (
                          <p className="text-[10px] text-gray-400 mb-2">
                            {agentName(lead.assigned_to)}
                          </p>
                        )}
                        {lead.next_followup_at && !['Won', 'Lost'].includes(lead.stage) && (
                          <p className="text-[10px] text-[#F97316] font-medium mb-2">
                            {formatDateTime(lead.next_followup_at)}
                          </p>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <ActionButtons phone={lead.phone} size="sm" onInteraction={(type) => handleInteraction(lead, type)} />
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="text-center py-6 text-gray-300 text-xs">No leads</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit/Details modal with tabs */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingLead ? editingLead.client_name : 'Add New Lead'}
        subtitle={editingLead ? `${editingLead.phone} · ${editingLead.stage}` : 'Log a new lead in the pipeline'}
        size="lg"
      >
        {editingLead && (
          <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setDetailTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                detailTab === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Pencil size={14} />
              Edit Details
            </button>
            <button
              onClick={() => setDetailTab('activity')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                detailTab === 'activity' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <History size={14} />
              Activity History
            </button>
          </div>
        )}

        {detailTab === 'edit' || !editingLead ? (
          <LeadForm
            lead={editingLead}
            users={users}
            projects={projects}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              fetchData();
            }}
          />
        ) : (
          <ActivityTimeline
            leadId={editingLead.id}
            users={users}
            refreshKey={activityRefreshKey}
          />
        )}
      </Modal>

      {/* Log interaction modal */}
      <LogInteractionModal
        open={!!logLead}
        lead={logLead}
        interactionType={interactionType}
        onClose={() => setLogLead(null)}
        onLogged={() => {
          setLogLead(null);
          setActivityRefreshKey((k) => k + 1);
          fetchData();
        }}
      />

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Lead"
        size="sm"
      >
        <p className="text-gray-600 mb-5">
          Are you sure you want to delete <span className="font-semibold text-gray-900">{confirmDelete?.client_name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(null)}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-gray-700 font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
