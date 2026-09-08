import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Lead, Project, LeadSource, LEAD_SOURCES } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import { AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { normalizeMobile } from '@/lib/utils';

interface DuplicateApprovalModalProps {
  open: boolean;
  existingLead: Lead | null;
  phone: string;
  clientName: string;
  projects: Project[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function DuplicateApprovalModal({
  open,
  existingLead,
  phone,
  clientName,
  projects,
  onClose,
  onSubmitted,
}: DuplicateApprovalModalProps) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState('');
  const [source, setSource] = useState<LeadSource>('Social Media');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const activeProjects = projects.filter((p) => p.status === 'active');

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);

    if (!projectId) {
      setError('Please select a target project');
      return;
    }

    setSaving(true);
    const normalized = normalizeMobile(phone);

    const payload = {
      lead_name: clientName,
      mobile_number: phone,
      project_id: projectId || null,
      requested_by: user.id,
      source,
      status: 'pending_approval',
    };

    // Also store normalized mobile for reference
    void normalized;

    const { error: insertError } = await supabase
      .from('duplicate_approval_requests')
      .insert(payload);

    if (insertError) {
      setError('Failed to submit request. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setProjectId('');
      setSource('Social Media');
      onSubmitted();
    }, 1800);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplicate Lead Found"
      subtitle="A lead with this phone number already exists"
      size="md"
    >
      {success ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Request Submitted</h3>
          <p className="text-sm text-gray-500 mt-1">
            Your duplicate approval request has been sent to the admin team for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">This phone number already exists in the system.</p>
              {existingLead && (
                <div className="mt-2 p-3 rounded-lg bg-white/60 border border-amber-200/60">
                  <p className="font-semibold text-gray-900">{existingLead.client_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {existingLead.phone} · Stage: {existingLead.stage} · Created {new Date(existingLead.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              <p className="mt-2">
                Direct lead creation is blocked. You can submit a <strong>duplicate approval request</strong> below — an admin will review it.
              </p>
            </div>
          </div>

          {/* Form fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Target Project <span className="text-red-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            >
              <option value="">Select a project...</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lead Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Buttons: primary left, cancel right */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !projectId}
              className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit Request
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-gray-700 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
