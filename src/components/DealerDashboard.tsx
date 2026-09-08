import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Lead,
  LeadStage,
  User,
  Project,
  LEAD_STAGES,
  STAGE_COLORS,
} from '@/lib/types';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import LeadForm from '@/components/LeadForm';
import DuplicateApprovalModal from '@/components/DuplicateApprovalModal';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ActionButtons from '@/components/ui/ActionButtons';
import { Plus, Briefcase, Clock, CheckCircle2, Building2, Tag, AlertTriangle, UserCircle } from 'lucide-react';
import { formatDateTime, timeAgo } from '@/lib/utils';

interface DealerDashboardProps {
  mode: 'submit' | 'leads';
  deepLinkLeadId?: string | null;
  onDeepLinkConsumed?: () => void;
}

export default function DealerDashboard({ mode, deepLinkLeadId, onDeepLinkConsumed }: DealerDashboardProps) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('dealer_id', user.id)
      .order('created_at', { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    supabase.from('users').select('*').then(({ data }) => setUsers((data as User[]) || []));
    supabase.from('projects').select('*').eq('status', 'active').then(({ data }) => setProjects((data as Project[]) || []));
    fetchLeads();
  }, [fetchLeads]);

  useDebouncedRealtimeLeads(fetchLeads);

  // Handle deep-link from push notification
  useEffect(() => {
    if (deepLinkLeadId && mode === 'leads') {
      setHighlightedLeadId(deepLinkLeadId);
      onDeepLinkConsumed?.();
      setTimeout(() => setHighlightedLeadId(null), 5000);
    }
  }, [deepLinkLeadId, mode, onDeepLinkConsumed]);

  const agentName = (id: string | null) => {
    if (!id) return 'Not yet assigned';
    const u = users.find((u) => u.id === id);
    return u?.full_name || u?.username || 'Unknown Agent';
  };

  const projectName = (id: string | null) => {
    if (!id) return null;
    const p = projects.find((p) => p.id === id);
    return p?.name || null;
  };

  const stats = {
    total: leads.length,
    won: leads.filter((l) => l.stage === 'Won').length,
    active: leads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length,
  };

  if (mode === 'submit') {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit New Lead</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Refer a new client to the Property Fy team</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <LeadForm
            lead={null}
            users={[]}
            projects={projects}
            onClose={() => {}}
            onSaved={() => { fetchLeads(); }}
            onDuplicatePhone={(existing) => {
              setDuplicateLead(existing);
              setShowForm(false);
            }}
          />
        </div>

        {/* Duplicate approval request */}
        <DuplicateApprovalModal
          open={!!duplicateLead}
          existingLead={duplicateLead}
          phone={duplicateLead?.phone || ''}
          clientName={duplicateLead?.client_name || ''}
          projects={projects}
          onClose={() => setDuplicateLead(null)}
          onSubmitted={() => { setDuplicateLead(null); fetchLeads(); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Submitted Leads</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{stats.total} leads submitted by you</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-95"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">New Lead</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white mb-3">
            <Briefcase size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-slate-500">Total Submitted</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center text-white mb-3">
            <Clock size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-sm text-slate-500">In Progress</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center text-white mb-3">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.won}</p>
          <p className="text-sm text-slate-500">Deals Won</p>
        </div>
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-gray-500 font-medium">No leads submitted yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "New Lead" to submit your first referral</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className={`bg-white rounded-2xl border p-4 transition ${
                highlightedLeadId === lead.id
                  ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 shadow-md'
                  : 'border-slate-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {lead.client_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{lead.client_name}</h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F97316] bg-[#F97316]/10 px-1.5 py-0.5 rounded">
                      <Tag size={9} /> Dealer
                    </span>
                    {projectName(lead.project_id) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded">
                        <Building2 size={9} /> {projectName(lead.project_id)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                    <span>{lead.phone}</span>
                    {lead.requirement && <span>· {lead.requirement}</span>}
                    <span>· {timeAgo(lead.created_at)}</span>
                  </div>
                  {/* Assigned agent name (read-only, no internal activity logs) */}
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
                    <UserCircle size={12} className="text-gray-400" />
                    <span className="font-bold text-slate-700">Agent: {agentName(lead.assigned_to)}</span>
                  </div>
                </div>
                <Badge className={`${STAGE_COLORS[lead.stage as LeadStage]?.bg || ''} ${STAGE_COLORS[lead.stage as LeadStage]?.text || ''} ${STAGE_COLORS[lead.stage as LeadStage]?.border || ''} border`}>
                  {lead.stage}
                </Badge>
                <ActionButtons phone={lead.phone} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit lead modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Submit New Lead"
        subtitle="Refer a client to the team"
      >
        <LeadForm
          lead={null}
          users={[]}
          projects={projects}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchLeads();
          }}
          onDuplicatePhone={(existing) => {
            setDuplicateLead(existing);
            setShowForm(false);
          }}
        />
      </Modal>

      {/* Duplicate approval request */}
      <DuplicateApprovalModal
        open={!!duplicateLead}
        existingLead={duplicateLead}
        phone={duplicateLead?.phone || ''}
        clientName={duplicateLead?.client_name || ''}
        projects={projects}
        onClose={() => setDuplicateLead(null)}
        onSubmitted={() => { setDuplicateLead(null); fetchLeads(); }}
      />
    </div>
  );
}
