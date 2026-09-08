import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Lead, InteractionOutcome, INTERACTION_OUTCOMES, INTERACTION_OUTCOME_COLORS } from '@/lib/types';
import { PhoneOutgoing, Search, X, Phone, Check, Calendar } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { telLink, toDateTimeLocal } from '@/lib/utils';

interface OutboundCallModalProps {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
}

export default function OutboundCallModal({ open, onClose, onLogged }: OutboundCallModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [outcome, setOutcome] = useState<InteractionOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [followup, setFollowup] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      setSelectedLead(null);
      setManualPhone('');
      setManualName('');
      setOutcome('');
      setNotes('');
      setFollowup('');
      setError(null);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!search.trim() || selectedLead) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const q = search.toLowerCase();
      let query = supabase.from('leads').select('*');
      if (user) query = query.eq('assigned_to', user.id);
      const { data } = await query.or(`client_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
      setResults((data as Lead[]) || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedLead, user]);

  const phoneNumber = selectedLead?.phone || manualPhone;
  const clientName = selectedLead?.client_name || manualName || 'Unknown';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phoneNumber.trim()) {
      setError('Please select a lead or enter a phone number');
      return;
    }
    if (!outcome) {
      setError('Please select a call outcome');
      return;
    }

    setSaving(true);

    const detailParts: string[] = [`Outcome: ${outcome}`, `Phone: ${phoneNumber}`];
    if (notes.trim()) detailParts.push(`Notes: ${notes.trim()}`);
    if (followup) detailParts.push(`Next follow-up: ${new Date(followup).toLocaleString()}`);

    const { error: logError } = await supabase.from('activity_logs').insert({
      lead_id: selectedLead?.id || null,
      user_id: user?.id || null,
      action: 'Outbound Call Logged',
      detail: detailParts.join(' | '),
    });

    if (logError) {
      setError('Failed to log call. Please try again.');
      setSaving(false);
      return;
    }

    if (selectedLead) {
      const updates: Record<string, unknown> = { call_outcome: outcome };
      if (followup) updates.next_followup_at = new Date(followup).toISOString();
      if (selectedLead.stage === 'New') updates.stage = 'Attempt';
      await supabase.from('leads').update(updates).eq('id', selectedLead.id);

      if (updates.stage && updates.stage !== selectedLead.stage) {
        await supabase.from('activity_logs').insert({
          lead_id: selectedLead.id,
          user_id: user?.id || null,
          action: 'Stage Change',
          detail: `${selectedLead.stage} → ${updates.stage as string} (auto: outbound call)`,
        });
      }
    }

    setSaving(false);
    onLogged();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Quick Outbound Dialer" subtitle="Search a lead or dial a number, then log the call" size="md">
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {!selectedLead && (
          <>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your leads by name or phone..."
                className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 text-slate-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {search.trim() && results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Leads</p>
                {results.map((lead) => (
                  <button
                    type="button"
                    key={lead.id}
                    onClick={() => { setSelectedLead(lead); setSearch(''); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {lead.client_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{lead.client_name}</p>
                      <p className="text-xs text-slate-500">{lead.phone} · {lead.stage}</p>
                    </div>
                    <Phone size={16} className="text-blue-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {search.trim() && results.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No matching leads. Dial manually below.</p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Or dial a number directly</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="Phone number"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                />
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Name (optional)"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                />
              </div>
            </div>
          </>
        )}

        {selectedLead && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {selectedLead.client_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{selectedLead.client_name}</p>
              <p className="text-xs text-slate-500">{selectedLead.phone} · {selectedLead.stage}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLead(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {phoneNumber && (
          <a
            href={telLink(phoneNumber)}
            onClick={() => {}}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow-sm transition active:scale-95"
          >
            <Phone size={18} />
            Dial {phoneNumber}
          </a>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Call Outcome</label>
          <div className="flex flex-wrap gap-2">
            {INTERACTION_OUTCOMES.map((o) => {
              const active = outcome === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    active
                      ? `${INTERACTION_OUTCOME_COLORS[o]} ring-2 ring-offset-1 ring-offset-white ring-current/20`
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition resize-none"
            placeholder="Call summary..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <Calendar size={14} className="inline mr-1 -mt-0.5" />
            Schedule Follow-up
          </label>
          <input
            type="datetime-local"
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !outcome || !phoneNumber}
            className="flex-1 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c9a232] text-[#1E293B] font-semibold shadow-md transition active:scale-[.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : (<><Check size={18} /> Log Call</>)}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
