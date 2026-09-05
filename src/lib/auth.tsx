import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from './supabase';
import { User, UserRole } from './types';
import { hashPassword } from './utils';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  isSuperAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  isDealer: boolean;
  isDealerManager: boolean;
  canDelete: boolean;
  canExport: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'propertyfy_session';
const SESSION_LOG_KEY = 'propertyfy_session_log_id';
const HEARTBEAT_MS = 30_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
        // Resume heartbeat for restored session
        const logId = sessionStorage.getItem(SESSION_LOG_KEY);
        if (logId) {
          startHeartbeat(parsed.id, logId);
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
    return () => stopHeartbeat();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const hash = hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim())
      .maybeSingle();

    if (error) {
      return { error: 'Unable to connect. Please try again.' };
    }

    if (!data || data.password_hash !== hash) {
      return { error: 'Invalid username or password' };
    }

    const loggedInUser = data as User;
    setUser(loggedInUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));

    // Record session start + last_login_at
    const nowIso = new Date().toISOString();
    supabase
      .from('users')
      .update({ last_login_at: nowIso, last_active_at: nowIso })
      .eq('id', loggedInUser.id)
      .then(() => {});

    const { data: sessionData } = await supabase
      .from('session_logs')
      .insert({ user_id: loggedInUser.id, login_at: nowIso })
      .select('id')
      .maybeSingle();

    if (sessionData?.id) {
      sessionStorage.setItem(SESSION_LOG_KEY, sessionData.id);
      startHeartbeat(loggedInUser.id, sessionData.id);
    }

    return { error: null };
  }, []);

  const logout = useCallback(() => {
    // Record session end
    const logId = sessionStorage.getItem(SESSION_LOG_KEY);
    if (logId) {
      supabase
        .from('session_logs')
        .update({ logout_at: new Date().toISOString() })
        .eq('id', logId)
        .then(() => {});
      sessionStorage.removeItem(SESSION_LOG_KEY);
    }
    stopHeartbeat();
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!user) return { error: 'Not logged in' };
      if (hashPassword(oldPassword) !== user.password_hash) {
        return { error: 'Current password is incorrect' };
      }
      if (newPassword.length < 6) {
        return { error: 'New password must be at least 6 characters' };
      }
      const newHash = hashPassword(newPassword);
      const { error } = await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('id', user.id);

      if (error) return { error: 'Failed to update password' };

      const updated = { ...user, password_hash: newHash };
      setUser(updated);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return { error: null };
    },
    [user]
  );

  const isSuperAdmin = user?.role === 'super_admin';
  const isManager = user?.role === 'manager';
  const isAgent = user?.role === 'agent';
  const isDealer = user?.role === 'dealer';
  const isDealerManager = user?.role === 'dealer_manager';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        changePassword,
        isSuperAdmin,
        isManager,
        isAgent,
        isDealer,
        isDealerManager,
        canDelete: isSuperAdmin,
        canExport: isSuperAdmin || isManager,
        canManageUsers: isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export type { AuthContextValue };

// ── Manager hierarchy helpers ─────────────────────────────────

/**
 * Returns the set of agent IDs that report to the given manager,
 * plus the manager's own ID (so their self-assigned leads are included).
 * For non-managers, returns an empty array.
 */
export async function fetchManagedAgentIds(managerId: string): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('manager_id', managerId);
  const agentIds = ((data as { id: string }[]) || []).map((r) => r.id);
  return [managerId, ...agentIds];
}

/**
 * Hook: returns a memoized function that, for the current logged-in manager,
 * resolves to the list of visible agent IDs (their own + their agents).
 * For super_admin / agent / dealer, returns null — meaning "no filtering needed"
 * (super_admin sees all; agent uses its own id directly).
 */
export function useVisibleAgentIds(): (() => Promise<string[] | null>) | null {
  const { user, isManager } = useAuth();
  if (!user) return null;
  if (!isManager) return null;
  return () => fetchManagedAgentIds(user.id);
}

// ── Heartbeat helpers (module-scoped) ────────────────────────
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(userId: string, sessionLogId: string) {
  stopHeartbeat();
  // Immediate ping
  supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
    .then(() => {});
  // Recurring ping
  heartbeatTimer = setInterval(() => {
    supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)
      .then(() => {});
  }, HEARTBEAT_MS);
  // Also record logout on tab close
  const handler = () => {
    if (sessionLogId) {
      const payload = { logout_at: new Date().toISOString() };
      // sendBeacon-style: fire and forget via fetch with keepalive
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/session_logs?id=eq.${sessionLogId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  };
  window.addEventListener('beforeunload', handler);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
