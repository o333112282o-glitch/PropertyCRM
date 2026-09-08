import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Lead,
  LeadStage,
  Project,
  STAGE_COLORS,
  DuplicateApprovalRequest,
} from '@/lib/types';
import { useDebouncedRealtimeLeads } from '@/lib/useRealtime';
import LeadForm from '@/components/LeadForm';
import DuplicateApprovalModal from '@/components/DuplicateApprovalModal';
import InboundCallModal from '@/components/InboundCallModal';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ActionButtons from '@/components/ui/ActionButtons';
import { Plus, PhoneIncoming, Briefcase, Clock, CheckCircle2, AlertTriangle, Phone } from 'lucide-react';
import { normalizeMobile, timeAgo, telLink, whatsappLink } from '@/lib/utils';

interface LeadCreatorDashboardProps {
  mode: 'submit' | 'leads';
}

export default function LeadCreatorDashboard({ mode }: LeadCreatorDashboardProps) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showInbound, setShowInbound] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string>('');
  const [pendingName, setPendingName] = useState<string>('');

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    supabase.from('projects').select('*').eq('status', 'active').then(({ data }) => setProjects((data as Project[]) || []));
    fetchLeads();
  }, [fetchLeads]);

  useDebouncedRealtimeLeads(fetchLeads);

  const stats = {
    total: leads.length,
    won: leads.filter((l) => l.stage === 'Won').length,
    active: leads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length,
  };

  const handleDuplicate = (existing: Lead) => {
    setDuplicateLead(existing);
    setPendingPhone(existing.phone);
    setPendingName(existing.client_name);
    setShowForm(false);
  };

  // ── Submit mode ───────────────────────────────────────────────
  if (mode === 'submit') {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quick Lead Entry</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Submit a new lead quickly</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-95"
          >
            <Plus size={20} />
            New Lead
          </button>
          <button
            onClick={() => setShowInbound(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-95"
          >
            <PhoneIncoming size={20} />
            Inbound Call
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white mb-3">
              <Briefcase size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-slate-500">Total Created</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center text-white mb-3">
              <Clock size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            <p className="text-sm text-slate-500">In Progress</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center text-white mb-3">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.won}</p>
            <p className="text-sm text-slate-500">Won</p>
          </div>
        </div>

        {/* Inline form (always visible) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <LeadForm
            lead={null}
            users={[]}
            projects={projects}
            onClose={() => {}}
            onSaved={() => { fetchLeads(); }}
            onDuplicatePhone={handleDuplicate}
          />
        </div>

        {/* Inbound call modal */}
        <InboundCallModal
          open={showInbound}
          users={[]}
          onClose={() => setShowInbound(false)}
          onCreated={() => { setShowInbound(false); fetchLeads(); }}
        />

        {/* Duplicate approval modal */}
        <DuplicateApprovalModal
          open={!!duplicateLead}
          existingLead={duplicateLead}
          phone={pendingPhone}
          clientName={pendingName}
          projects={projects}
          onClose={() => setDuplicateLead(null)}
          onSubmitted={() => { setDuplicateLead(null); fetchLeads(); }}
        />
      </div>
    );
  }

  // ── My Leads mode ─────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{stats.total} leads you have created</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-95"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">New Lead</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Briefcase size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-gray-500 font-medium">No leads created yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "New Lead" to create your first lead</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leads.map((lead) => {
            const colors = STAGE_COLORS[lead.stage as LeadStage];
            return (
              <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {lead.client_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{lead.client_name}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                      <span>{lead.phone}</span>
                      {lead.requirement && <span>· {lead.requirement}</span>}
                      <span>· {timeAgo(lead.created_at)}</span>
                    </div>
                  </div>
                  <Badge className={`${colors.bg} ${colors.text} ${colors.border} border`}>
                    {lead.stage}
                  </Badge>
                  <ActionButtons phone={lead.phone} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New lead modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Lead" subtitle="Create a new lead">
        <LeadForm
          lead={null}
          users={[]}
          projects={projects}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchLeads(); }}
          onDuplicatePhone={handleDuplicate}
        />
      </Modal>

      {/* Duplicate approval modal */}
      <DuplicateApprovalModal
        open={!!duplicateLead}
        existingLead={duplicateLead}
        phone={pendingPhone}
        clientName={pendingName}
        projects={projects}
        onClose={() => setDuplicateLead(null)}
        onSubmitted={() => { setDuplicateLead(null); fetchLeads(); }}
      />
    </div>
  );
}
