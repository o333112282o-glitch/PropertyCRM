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

    const updates: Record<string, unknown> = {
      stage,
      notes: notes.trim(),
      project_id: projectId || null,
    };

    if (followup) {
      updates.next_followup_at = new Date(followup).toISOString();
    } else if (stage !== 'Follow-up Date') {
      updates.next_followup_at = null;
    }

    await supabase.from('leads').update(updates).eq('id', lead.id);

    await supabase.from('activity_logs').insert({
      lead_id: lead.id,
      user_id: user?.id,
      action: 'Quick Edit',
      detail: `Stage: ${stage}${notes.trim() ? ` | Notes: ${notes.trim().slice(0, 80)}` : ''}`,
    });

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
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-[slideInRight_.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{lead.client_name}</h2>
            <p className="text-sm text-gray-500">{lead.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Stage selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Stage</label>
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

          {/* Project selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            >
              <option value="">No project</option>
              {projects.filter((p) => p.status === 'active').map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quick Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition resize-none"
              placeholder="Add a quick note..."
            />
          </div>

          {/* Follow-up */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <Clock3 size={14} className="inline mr-1 -mt-0.5" />
              Next Follow-up
            </label>
            <input
              type="datetime-local"
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60 flex items-center justify-center gap-2"
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
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </>
  );
}
