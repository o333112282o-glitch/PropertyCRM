import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Lead, LeadStage, Project, LEAD_STAGES, STAGE_COLORS } from '@/lib/types';
import { X, Save, Clock3, FolderOpen } from 'lucide-react';
import { toDateTimeLocal } from '@/lib/utils';

interface QuickEditDrawerProps {
  lead: Lead | null;
  open: boolean;
  projects?: Project[];
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickEditDrawer({ lead, open, projects = [], onClose, onSaved }: QuickEditDrawerProps) {
  const { user } = useAuth();
  const [stage, setStage] = useState<LeadStage>('New');
  const [notes, setNotes] = useState('');
  const [followup, setFollowup] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setStage(lead.stage);
      setNotes(lead.notes || '');
      setFollowup(toDateTimeLocal(lead.next_followup_at));
      setProjectId(lead.project_id || '');
    }
  }, [lead]);

  if (!open || !lead) return null;

  const handleSave = async () => {
    setSaving(true);

    const stageChanged = stage !== lead.stage;
    const updates: Record<string, unknown> = {
      stage,
      notes: notes.trim(),
      project_id: projectId || null,
    };

    if (followup) {
      updates.next_followup_at = new Date(followup).toISOString();
    } else if (!['Follow-up Date', 'Token Received'].includes(stage)) {
      updates.next_followup_at = null;
    }

    if (stage === 'Won' || stage === 'Lost') {
      updates.next_followup_at = null;
    }

    const { error: updateError } = await supabase.from('leads').update(updates).eq('id', lead.id);
    if (updateError) {
      console.warn('Lead update failed:', updateError.message);
    }

    if (stageChanged) {
      await supabase.from('activity_logs').insert({
        lead_id: lead.id,
        user_id: user?.id,
        action: 'Stage Change',
        detail: `${lead.stage} → ${stage}${notes.trim() ? ` | Notes: ${notes.trim().slice(0, 80)}` : ''}`,
      });
    } else {
      await supabase.from('activity_logs').insert({
        lead_id: lead.id,
        user_id: user?.id,
        action: 'Quick Edit',
        detail: notes.trim() ? `Notes updated: ${notes.trim().slice(0, 80)}` : 'Lead details updated',
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#1E293B] border-l border-white/10 shadow-2xl z-50 flex flex-col animate-[slideInRight_.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{lead.client_name}</h2>
            <p className="text-sm text-slate-400">{lead.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Stage selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Stage</label>
            <div className="flex flex-wrap gap-2">
              {LEAD_STAGES.map((s) => {
                const colors = STAGE_COLORS[s];
                const active = stage === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStage(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      active
                        ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-1 ring-offset-[#1E293B] ring-current/20`
                        : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl surface-dark text-slate-200 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            >
              <option value="">No project</option>
              {projects.filter((p) => p.status === 'active').map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Quick Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl surface-dark text-slate-200 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition resize-none"
              placeholder="Add a quick note..."
            />
          </div>

          {/* Follow-up */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              <Clock3 size={14} className="inline mr-1 -mt-0.5" />
              Next Follow-up
            </label>
            <input
              type="datetime-local"
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl surface-dark text-slate-200 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c9a232] text-[#1E293B] font-semibold shadow-lg shadow-[#D4AF37]/20 transition active:scale-[.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : (
              <>
                <Save size={18} />
                Save
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 font-semibold hover:bg-white/5 transition"
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </>
  );
}
