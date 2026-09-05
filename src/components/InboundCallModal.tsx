import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Lead, User } from '@/lib/types';
import { PhoneIncoming, Search, Plus, X, Phone } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface InboundCallModalProps {
  open: boolean;
  users: User[];
  onClose: () => void;
  onCreated: () => void;
}

export default function InboundCallModal({ open, users, onClose, onCreated }: InboundCallModalProps) {
  const { user, isAgent } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      setShowNewForm(false);
      setClientName('');
      setPhone('');
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!search.trim() || showNewForm) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const q = search.toLowerCase();
      let query = supabase.from('leads').select('*');
      if (isAgent && user) {
        query = query.eq('assigned_to', user.id);
      }
      const { data } = await query.or(`client_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
      setResults((data as Lead[]) || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, showNewForm, isAgent, user]);

  const handleCreate = async () => {
    if (!clientName.trim() || !phone.trim()) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      client_name: clientName.trim(),
      phone: phone.trim(),
      lead_source: 'Inbound Call',
      stage: 'New',
      assigned_to: isAgent ? user?.id : null,
    };

    await supabase.from('leads').insert(payload);
    setSaving(false);
    onCreated();
  };

  const agents = users.filter((u) => u.role === 'agent' || u.role === 'manager');

  return (
    <Modal open={open} onClose={onClose} title="Inbound Call" subtitle="Search for an existing lead or create a new one" size="md">
      {!showNewForm ? (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone number..."
              className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Results */}
          {search.trim() && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Existing Leads</p>
              {results.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                  onClick={() => {
                    onClose();
                  }}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {lead.client_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.client_name}</p>
                    <p className="text-xs text-gray-500">{lead.phone} · {lead.stage}</p>
                  </div>
                  <Phone size={16} className="text-blue-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {search.trim() && results.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-3">No matching leads found</p>
            </div>
          )}

          {/* Create new */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setShowNewForm(true);
                if (search) setPhone(search);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-[.98]"
            >
              <Plus size={18} />
              Create New Lead as Inbound Call
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
            />
          </div>
          {!isAgent && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assign To</label>
              <select
                value={user?.id || ''}
                onChange={() => {}}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] outline-none transition"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name || a.username}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F97316]/10 border border-[#F97316]/20">
            <PhoneIncoming size={16} className="text-[#F97316] flex-shrink-0" />
            <span className="text-sm text-[#F97316] font-medium">Lead will be tagged as "Inbound Call"</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={saving || !clientName.trim() || !phone.trim()}
              className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60"
            >
              {saving ? 'Creating...' : 'Create Lead'}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
