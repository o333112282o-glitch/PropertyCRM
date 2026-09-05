import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Lead,
  InteractionType,
  InteractionOutcome,
  INTERACTION_OUTCOMES,
  INTERACTION_OUTCOME_COLORS,
} from '@/lib/types';
import { toDateTimeLocal } from '@/lib/utils';
import { Phone, MessageCircle, Calendar, StickyNote, Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface LogInteractionModalProps {
  open: boolean;
  lead: Lead | null;
  interactionType: InteractionType;
  onClose: () => void;
  onLogged: () => void;
}

export default function LogInteractionModal({
  open,
  lead,
  interactionType,
  onClose,
  onLogged,
}: LogInteractionModalProps) {
  const { user } = useAuth();
  const [outcome, setOutcome] = useState<InteractionOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [followup, setFollowup] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lead) return null;

  const isCall = interactionType === 'call';
  const Icon = isCall ? Phone : MessageCircle;
  const iconColor = isCall ? 'bg-blue-500' : 'bg-green-500';
  const title = isCall ? 'Log Call Interaction' : 'Log WhatsApp Interaction';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!outcome) {
      setError('Please select an outcome');
      return;
    }

    setSaving(true);

    const actionLabel = isCall ? 'Call Logged' : 'WhatsApp Logged';
    const detailParts: string[] = [`Outcome: ${outcome}`];
    if (notes.trim()) detailParts.push(`Notes: ${notes.trim()}`);
    if (followup) detailParts.push(`Next follow-up: ${new Date(followup).toLocaleString()}`);

    const { error: logError } = await supabase.from('activity_logs').insert({
      lead_id: lead.id,
      user_id: user?.id || null,
      action: actionLabel,
      detail: detailParts.join(' | '),
    });

    if (logError) {
      setError('Failed to save interaction log. Please try again.');
      setSaving(false);
      return;
    }

    if (followup) {
      await supabase
        .from('leads')
        .update({ next_followup_at: new Date(followup).toISOString() })
        .eq('id', lead.id);
    }

    setSaving(false);
    setOutcome('');
    setNotes('');
    setFollowup('');
    onLogged();
  };

  const handleClose = () => {
    setOutcome('');
    setNotes('');
    setFollowup('');
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} subtitle={lead.client_name} size="md">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center text-white flex-shrink-0`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{lead.client_name}</p>
            <p className="text-xs text-gray-500">{lead.phone}</p>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Outcome</label>
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
                      ? `${INTERACTION_OUTCOME_COLORS[o]} ring-2 ring-offset-1 ring-current/20`
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
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <StickyNote size={14} className="inline mr-1 -mt-0.5" />
            Notes / Summary
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition resize-none"
            placeholder="What happened during this interaction?"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <Calendar size={14} className="inline mr-1 -mt-0.5" />
            Next Follow-up Date &amp; Time
          </label>
          <input
            type="datetime-local"
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
          />
          <p className="text-xs text-gray-400 mt-1">Optional — set the next follow-up reminder for this lead</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Check size={18} />
                Save Log
              </>
            )}
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
