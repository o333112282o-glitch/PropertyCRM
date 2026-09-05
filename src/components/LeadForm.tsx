import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Lead,
  LeadSource,
  LeadStage,
  CallOutcome,
  User,
  Project,
  LEAD_SOURCES,
  LEAD_STAGES,
  CALL_OUTCOMES,
  STAGE_COLORS,
  CALL_OUTCOME_COLORS,
} from '@/lib/types';
import { toDateTimeLocal } from '@/lib/utils';
import { Phone, PhoneOff, XCircle, Frown, Clock3, ThumbsUp } from 'lucide-react';

interface LeadFormProps {
  lead: Lead | null;
  users: User[];
  projects?: Project[];
  onClose: () => void;
  onSaved: () => void;
  onDuplicatePhone?: (existingLead: Lead) => void;
}

const CALL_OUTCOME_ICONS: Record<CallOutcome, typeof Phone> = {
  'Not Responding': PhoneOff,
  'Wrong Number': XCircle,
  'Not Interested': Frown,
  'Call Back Later': Clock3,
  'Interested': ThumbsUp,
};

export default function LeadForm({ lead, users, projects = [], onClose, onSaved, onDuplicatePhone }: LeadFormProps) {
  const { user, isAgent, isDealer } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState(lead?.client_name || '');
  const [phone, setPhone] = useState(lead?.phone || '');
  const [requirement, setRequirement] = useState(lead?.requirement || '');
  const [budgetRange, setBudgetRange] = useState(lead?.budget_range || '');
  const [leadSource, setLeadSource] = useState<LeadSource>(lead?.lead_source || 'Social Media');
  const [stage, setStage] = useState<LeadStage>(lead?.stage || 'New');
  const [assignedTo, setAssignedTo] = useState<string>(lead?.assigned_to || (isAgent ? user?.id || '' : ''));
  const [nextFollowup, setNextFollowup] = useState(toDateTimeLocal(lead?.next_followup_at || null));
  const [tokenAmount, setTokenAmount] = useState(lead?.token_amount?.toString() || '');
  const [notes, setNotes] = useState(lead?.notes || '');
  const [callOutcome, setCallOutcome] = useState<CallOutcome | ''>(lead?.call_outcome || '');
  const [callbackDateTime, setCallbackDateTime] = useState(
    lead?.next_followup_at ? toDateTimeLocal(lead.next_followup_at) : ''
  );
  const [projectId, setProjectId] = useState<string>(lead?.project_id || '');

  const agents = users.filter((u) => u.role === 'agent' || u.role === 'manager');
  const activeProjects = projects.filter((p) => p.status === 'active');
  const needsFollowup = stage === 'Follow-up Date';
  const needsToken = stage === 'Token Received';
  const isColdCalling = leadSource === 'Cold Calling';
  const needsCallbackDateTime = callOutcome === 'Call Back Later';

  // Auto-move to New/Attempt when "Interested" is selected
  useEffect(() => {
    if (callOutcome === 'Interested' && (stage === 'Lost' || stage === 'New')) {
      setStage('Attempt');
    }
  }, [callOutcome, stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientName.trim() || !phone.trim()) {
      setError('Client name and phone number are required');
      return;
    }

    if (needsFollowup && !nextFollowup) {
      setError('Next follow-up date is required when stage is "Follow-up Date"');
      return;
    }

    if (needsCallbackDateTime && !callbackDateTime) {
      setError('Callback date & time is required when call outcome is "Call Back Later"');
      return;
    }

    setSaving(true);

    // Duplicate phone check for new leads
    if (!lead && onDuplicatePhone) {
      const { data: existing } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();
      if (existing) {
        setSaving(false);
        onDuplicatePhone(existing as Lead);
        return;
      }
    }

    const followupValue = needsFollowup && nextFollowup
      ? new Date(nextFollowup).toISOString()
      : needsCallbackDateTime && callbackDateTime
        ? new Date(callbackDateTime).toISOString()
        : lead?.next_followup_at || null;

    const payload: Record<string, unknown> = {
      client_name: clientName.trim(),
      phone: phone.trim(),
      requirement: requirement.trim() || null,
      budget_range: budgetRange.trim() || null,
      lead_source: leadSource,
      stage,
      assigned_to: assignedTo || null,
      next_followup_at: followupValue,
      token_amount: needsToken && tokenAmount ? parseFloat(tokenAmount) : null,
      notes: notes.trim(),
      call_outcome: callOutcome || null,
      project_id: projectId || null,
    };

    // Tag dealer-sourced leads and bind dealer_id permanently
    if (isDealer && user) {
      payload.source_dealer_id = user.id;
      if (!lead) {
        payload.lead_source = 'Dealer Sourced' as LeadSource;
        payload.dealer_id = user.id;
      } else if (!lead.dealer_id) {
        payload.dealer_id = user.id;
      }
    }

    let result;
    if (lead) {
      result = await supabase.from('leads').update(payload).eq('id', lead.id);
    } else {
      result = await supabase.from('leads').insert(payload);
    }

    if (result.error) {
      setError('Failed to save lead. Please try again.');
      setSaving(false);
      return;
    }

    // Log activity
    if (lead) {
      await supabase.from('activity_logs').insert({
        lead_id: lead.id,
        user_id: user?.id,
        action: 'Lead Updated',
        detail: `Stage: ${stage}${callOutcome ? ` | Call: ${callOutcome}` : ''}`,
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            placeholder="e.g. Imran Khan"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            placeholder="+92 300 1234567"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Requirement / Unit Type
          </label>
          <input
            type="text"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            placeholder="e.g. 2-Bed Apartment, 120 Sq Yds Plot"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Budget Range
          </label>
          <input
            type="text"
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            placeholder="e.g. 45-55 Lacs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lead Source</label>
          <select
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value as LeadSource)}
            disabled={isDealer}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition bg-white disabled:bg-slate-50 disabled:text-slate-500"
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {isDealer && <option value="Dealer Sourced">Dealer Sourced</option>}
          </select>
        </div>

        {!isDealer && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assigned Agent</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={isAgent}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition bg-white disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.username}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
        >
          <option value="">No project selected</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!isDealer && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Stage</label>
          <div className="flex flex-wrap gap-2">
            {LEAD_STAGES.map((s) => {
              const colors = STAGE_COLORS[s];
              const active = stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    active
                      ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-1 ring-current/20`
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {needsFollowup && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Next Follow-up Date &amp; Time <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={nextFollowup}
            onChange={(e) => setNextFollowup(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            required={needsFollowup}
          />
        </div>
      )}

      {needsToken && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Token Amount (Rs.)</label>
          <input
            type="number"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            placeholder="e.g. 50000"
            min="0"
          />
        </div>
      )}

      {/* Cold Call Outcome Workflow */}
      {isColdCalling && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Call Outcome Status</label>
          <div className="flex flex-wrap gap-2">
            {CALL_OUTCOMES.map((outcome) => {
              const Icon = CALL_OUTCOME_ICONS[outcome];
              const active = callOutcome === outcome;
              return (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => setCallOutcome(outcome)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    active
                      ? CALL_OUTCOME_COLORS[outcome] + ' ring-2 ring-offset-1 ring-current/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon size={14} />
                  {outcome}
                </button>
              );
            })}
          </div>

          {needsCallbackDateTime && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Callback Date &amp; Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={callbackDateTime}
                onChange={(e) => setCallbackDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition bg-white"
                required={needsCallbackDateTime}
              />
            </div>
          )}

          {callOutcome === 'Interested' && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <ThumbsUp size={12} />
              Lead will be moved to "Attempt" stage automatically.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes / Interaction History</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition resize-none"
          placeholder="Add notes about interactions, preferences, etc."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60"
        >
          {saving ? 'Saving...' : lead ? 'Update Lead' : 'Add Lead'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
