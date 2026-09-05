import { useState } from 'react';
import { Lock, User as UserIcon, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

function GoldBuildingIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21V7L12 3L21 7V21H14V14H10V21H3Z" stroke="#D4AF37" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 10H8M11 10H12M15 10H16M7 13H8M15 13H16" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await login(username, password);
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Left brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-[#1E293B] via-[#334155] to-[#1E293B] text-white p-8 lg:p-12 flex flex-col justify-between min-h-[40vh] lg:min-h-screen relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#F97316]/10 rounded-full blur-3xl translate-y-1/3" />

        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1E293B] border-2 border-[#D4AF37] flex items-center justify-center shadow-lg">
            <GoldBuildingIcon size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Property Fy</h1>
            <p className="text-sm text-white/60">Real Estate CRM</p>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Close more deals.<br />
            <span className="text-[#D4AF37]">Track every lead.</span>
          </h2>
          <p className="text-lg text-white/70 max-w-md">
            Your complete real estate sales pipeline — from first contact to token received, all in one place.
          </p>
          <div className="mt-8 flex gap-8">
            <div>
              <p className="text-3xl font-bold text-[#D4AF37]">7</p>
              <p className="text-sm text-white/60">Pipeline Stages</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#F97316]">1-tap</p>
              <p className="text-sm text-white/60">Call & WhatsApp</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">RBAC</p>
              <p className="text-sm text-white/60">Role-based Access</p>
            </div>
          </div>
        </div>

        <div className="relative text-sm text-white/40">
          &copy; 2026 Property Fy. All rights reserved.
        </div>
      </div>

      {/* Right login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-12 flex-1">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-[#1E293B] border-2 border-[#D4AF37] flex items-center justify-center">
              <GoldBuildingIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1E293B]">Property Fy</h1>
              <p className="text-xs text-slate-500">Real Estate CRM</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition-all active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
