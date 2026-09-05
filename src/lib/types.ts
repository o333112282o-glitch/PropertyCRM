export type UserRole = 'super_admin' | 'manager' | 'agent' | 'dealer' | 'dealer_manager';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  mobile: string | null;
  full_name: string | null;
  manager_id: string | null;
  created_at: string;
  last_login_at: string | null;
  last_active_at: string | null;
}

export type LeadSource = 'Social Media' | 'Direct Marketing/Visit' | 'Walk-in' | 'Cold Calling' | 'Dealer Sourced' | 'Inbound Call';

export type LeadStage =
  | 'New'
  | 'Attempt'
  | 'Follow-up Date'
  | 'Negotiate'
  | 'Token Received'
  | 'Won'
  | 'Lost';

// ── Lead Aging ───────────────────────────────────────────────
export type AgingLevel = 'fresh' | 'stale' | 'aged';

/** Calculate aging for non-terminal leads. Returns days open + severity level. */
export function getLeadAging(createdAt: string, stage: LeadStage): { days: number; level: AgingLevel } | null {
  if (stage === 'Won' || stage === 'Lost') return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days <= 7) return { days, level: 'fresh' };
  if (days <= 15) return { days, level: 'stale' };
  return { days, level: 'aged' };
}

export const AGING_COLORS: Record<AgingLevel, string> = {
  fresh: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  stale: 'bg-orange-50 text-orange-700 border-orange-200',
  aged: 'bg-red-50 text-red-700 border-red-200',
};

export type CallOutcome =
  | 'Not Responding'
  | 'Wrong Number'
  | 'Not Interested'
  | 'Call Back Later'
  | 'Interested';

export interface Lead {
  id: string;
  client_name: string;
  phone: string;
  requirement: string | null;
  budget_range: string | null;
  lead_source: LeadSource;
  stage: LeadStage;
  assigned_to: string | null;
  next_followup_at: string | null;
  token_amount: number | null;
  notes: string;
  call_outcome: CallOutcome | null;
  source_dealer_id: string | null;
  project_id: string | null;
  dealer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadWithAgent extends Lead {
  agent?: User | null;
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  location: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  lead_id: string;
  user_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
  user?: User | null;
}

export const LEAD_SOURCES: LeadSource[] = [
  'Social Media',
  'Direct Marketing/Visit',
  'Walk-in',
  'Cold Calling',
  'Inbound Call',
];

export const LEAD_STAGES: LeadStage[] = [
  'New',
  'Attempt',
  'Follow-up Date',
  'Negotiate',
  'Token Received',
  'Won',
  'Lost',
];

export const CALL_OUTCOMES: CallOutcome[] = [
  'Not Responding',
  'Wrong Number',
  'Not Interested',
  'Call Back Later',
  'Interested',
];

// ── Date Range Types ─────────────────────────────────────────
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'ytd' | 'custom' | 'all';

export interface DateRange {
  start: Date;
  end: Date;
}

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' },
];

export function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start.setTime(y.getTime());
      start.setHours(0, 0, 0, 0);
      end.setTime(y.getTime());
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_week': {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last_month': {
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'ytd':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all':
      start.setTime(0);
      break;
    default:
      break;
  }
  return { start, end };
}

export const STAGE_COLORS: Record<LeadStage, { bg: string; text: string; border: string; dot: string }> = {
  'New': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'Attempt': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Follow-up Date': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Negotiate': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Token Received': { bg: 'bg-[#D4AF37]/10', text: 'text-[#b8941e]', border: 'border-[#D4AF37]/30', dot: 'bg-[#D4AF37]' },
  'Won': { bg: 'bg-[#D4AF37]/15', text: 'text-[#a67c00]', border: 'border-[#D4AF37]/40', dot: 'bg-[#D4AF37]' },
  'Lost': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', dot: 'bg-slate-400' },
};

export const CALL_OUTCOME_COLORS: Record<CallOutcome, string> = {
  'Not Responding': 'bg-slate-100 text-slate-700 border-slate-200',
  'Wrong Number': 'bg-red-50 text-red-700 border-red-200',
  'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200',
  'Call Back Later': 'bg-orange-50 text-orange-700 border-orange-200',
  'Interested': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ── Interaction Logging ──────────────────────────────────────
export type InteractionType = 'call' | 'whatsapp';
export type InteractionOutcome =
  | 'Connected/Answered'
  | 'No Answer'
  | 'WhatsApp Sent'
  | 'WhatsApp Replied';

export const INTERACTION_OUTCOMES: InteractionOutcome[] = [
  'Connected/Answered',
  'No Answer',
  'WhatsApp Sent',
  'WhatsApp Replied',
];

export const INTERACTION_OUTCOME_COLORS: Record<InteractionOutcome, string> = {
  'Connected/Answered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'No Answer': 'bg-slate-100 text-slate-700 border-slate-200',
  'WhatsApp Sent': 'bg-green-50 text-green-700 border-green-200',
  'WhatsApp Replied': 'bg-[#D4AF37]/15 text-[#a67c00] border-[#D4AF37]/30',
};

// Maps (type, outcome) to a short badge label shown on the timeline
export const INTERACTION_BADGE_LABEL: Record<InteractionType, string> = {
  call: 'Call Logged',
  whatsapp: 'WhatsApp Logged',
};

// ── Session Tracking ────────────────────────────────────────
export interface SessionLog {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  created_at: string;
}

export type PresenceStatus = 'online' | 'idle' | 'offline';

/** Determine presence from last_active_at: <5min = online, <15min = idle, else offline */
export function getPresence(lastActiveAt: string | null): PresenceStatus {
  if (!lastActiveAt) return 'offline';
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  if (diff < 5 * 60 * 1000) return 'online';
  if (diff < 15 * 60 * 1000) return 'idle';
  return 'offline';
}

export const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  offline: 'bg-slate-300',
};

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  manager: 'Sales Manager',
  agent: 'Sales Agent',
  dealer: 'Dealer',
  dealer_manager: 'Dealer Manager',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-[#D4AF37]/15 text-[#a67c00] border-[#D4AF37]/30',
  manager: 'bg-orange-50 text-orange-700 border-orange-200',
  agent: 'bg-sky-50 text-sky-700 border-sky-200',
  dealer: 'bg-slate-100 text-slate-700 border-slate-300',
  dealer_manager: 'bg-purple-50 text-purple-700 border-purple-200',
};
