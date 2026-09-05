import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Edit2, Search, UserCog, Shield, User as UserIcon, Store, Users, ClipboardList, Handshake } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { User, UserRole, ROLE_LABELS, ROLE_COLORS, getPresence, PRESENCE_COLORS, PRESENCE_LABELS } from '@/lib/types';
import { hashPassword, formatDate, formatDateTime } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import TeamLogs from '@/components/TeamLogs';

type Tab = 'team' | 'logs';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('team');

  // form state
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [password, setPassword] = useState('');
  const [managerId, setManagerId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true });
    setUsers((data as User[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Refresh presence every 60s
    const timer = setInterval(fetchUsers, 60000);
    return () => clearInterval(timer);
  }, [fetchUsers]);

  const openAdd = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setMobile('');
    setRole('agent');
    setPassword('');
    setManagerId('');
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.full_name || '');
    setMobile(u.mobile || '');
    setRole(u.role);
    setPassword('');
    setManagerId(u.manager_id || '');
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!username.trim()) {
      setFormError('Username is required');
      return;
    }
    if (!editingUser && password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      username: username.trim(),
      full_name: fullName.trim() || null,
      mobile: mobile.trim() || null,
      role,
      manager_id: (role === 'agent' || role === 'dealer') ? (managerId || null) : null,
    };

    if (password) {
      payload.password_hash = hashPassword(password);
    }

    let result;
    if (editingUser) {
      result = await supabase.from('users').update(payload).eq('id', editingUser.id);
    } else {
      payload.password_hash = hashPassword(password);
      result = await supabase.from('users').insert(payload);
    }

    if (result.error) {
      if (result.error.code === '23505') {
        setFormError('Username already exists. Choose a different one.');
      } else {
        setFormError('Failed to save user. Please try again.');
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from('users').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    fetchUsers();
  };

  const filteredUsers = useMemo(() => users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        (u.mobile?.includes(q) ?? false)
      );
  }), [users, search]);

  const onlineCount = useMemo(
    () => users.filter((u) => (u.role === 'agent' || u.role === 'manager') && getPresence(u.last_active_at) === 'online').length,
    [users]
  );

  const roleIcon = (r: UserRole) => {
    if (r === 'super_admin') return Shield;
    if (r === 'manager') return UserCog;
    if (r === 'dealer') return Store;
    if (r === 'dealer_manager') return Handshake;
    return UserIcon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {users.length} members · <span className="text-emerald-600 font-medium">{onlineCount} online</span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-95"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Member</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setTab('team')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'team' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} />
          Members
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'logs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList size={16} />
          Team Logs
        </button>
      </div>

      {/* Team Members Tab */}
      {tab === 'team' && (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or mobile..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            />
          </div>

          <div className="space-y-2.5">
            {filteredUsers.map((u) => {
              const Icon = roleIcon(u.role);
              const isSelf = u.id === currentUser?.id;
              const presence = getPresence(u.last_active_at);
              const isTeamMember = u.role === 'agent' || u.role === 'manager';
              return (
                <div key={u.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                        u.role === 'super_admin' ? 'bg-[#D4AF37]/15 text-[#a67c00]' :
                        u.role === 'manager' ? 'bg-orange-50 text-orange-600' :
                        u.role === 'dealer' ? 'bg-slate-100 text-slate-600' :
                        u.role === 'dealer_manager' ? 'bg-purple-50 text-purple-600' :
                        'bg-sky-50 text-sky-600'
                      }`}>
                        {u.full_name?.[0] || u.username[0].toUpperCase()}
                      </div>
                      {isTeamMember && (
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${PRESENCE_COLORS[presence]} border-2 border-white`}
                          title={PRESENCE_LABELS[presence]}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {u.full_name || u.username}
                        </h3>
                        {isSelf && (
                          <span className="text-[10px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded">YOU</span>
                        )}
                        {isTeamMember && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            presence === 'online' ? 'bg-emerald-50 text-emerald-600' :
                            presence === 'idle' ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {PRESENCE_LABELS[presence]}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                        <span>@{u.username}</span>
                        {u.mobile && <span>{u.mobile}</span>}
                        <span>Joined {formatDate(u.created_at)}</span>
                        {isTeamMember && u.last_login_at && (
                          <span className="text-gray-400">Last login: {formatDateTime(u.last_login_at)}</span>
                        )}
                      </div>
                    </div>

                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[u.role]}`}>
                      <Icon size={12} />
                      {ROLE_LABELS[u.role]}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      {!isSelf && u.role !== 'super_admin' && (
                        <button
                          onClick={() => setConfirmDelete(u)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile role badge */}
                  <div className="sm:hidden mt-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[u.role]}`}>
                      <Icon size={12} />
                      {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Team Logs Tab */}
      {tab === 'logs' && <TeamLogs users={users} />}

      {/* Add/Edit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingUser ? 'Edit Team Member' : 'Add Team Member'}
        subtitle={editingUser ? editingUser.username : 'Create a new Sales Manager, Agent, or Dealer account'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                placeholder="e.g. agent3"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {role === 'dealer' ? 'Agency Name' : 'Full Name'}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                placeholder={role === 'dealer' ? 'e.g. Khan Real Estate Agency' : 'e.g. Rajesh Kumar'}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mobile Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assigned Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              >
                <option value="agent">Sales Agent</option>
                <option value="manager">Sales Manager</option>
                <option value="dealer">Dealer</option>
                <option value="dealer_manager">Dealer Manager</option>
                {currentUser?.role === 'super_admin' && (
                  <option value="super_admin">Super Admin</option>
                )}
              </select>
            </div>
          </div>

          {role === 'agent' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Assign Manager
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              >
                <option value="">No manager assigned</option>
                {users.filter((u) => u.role === 'manager').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          {role === 'dealer' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Assign Dealer Manager
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              >
                <option value="">No dealer manager assigned</option>
                {users.filter((u) => u.role === 'dealer_manager').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Password {editingUser && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              placeholder="Minimum 6 characters"
              required={!editingUser}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingUser ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-gray-700 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete User" size="sm">
        <p className="text-gray-600 mb-5">
          Delete <span className="font-semibold text-gray-900">{confirmDelete?.full_name || confirmDelete?.username}</span>? Their assigned leads will become unassigned.
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
