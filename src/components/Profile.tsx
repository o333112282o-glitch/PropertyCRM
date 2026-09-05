import { useState } from 'react';
import { UserCircle, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Phone, Calendar, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function Profile() {
  const { user, changePassword, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setSaving(true);
    const { error } = await changePassword(oldPassword, newPassword);
    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: error });
    } else {
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Manage your account and password</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1E293B] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {user.full_name?.[0] || user.username[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900">{user.full_name || user.username}</h2>
            <p className="text-gray-500">@{user.username}</p>
            <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[user.role]}`}>
              <Shield size={12} />
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Mobile</p>
              <p className="text-sm font-medium text-gray-900">{user.mobile || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Member Since</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(user.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={20} className="text-[#D4AF37]" />
          <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4 ${
              message.type === 'success'
                ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#a67c00]'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3.5 pr-12 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                placeholder="Re-enter new password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98] disabled:opacity-60"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
