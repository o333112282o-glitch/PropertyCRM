import { useMemo, useState } from 'react';
import {
  Phone, PhoneOutgoing, PhoneIncoming, PhoneMissed,
  CheckCircle2, XCircle, Clock, X, ChevronRight, User,
} from 'lucide-react';
import { Lead, User as UserType, ActivityLog, CALL_OUTCOME_COLORS } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

interface CallPerformanceAnalyticsProps {
  leads: Lead[];
  activityLogs: ActivityLog[];
  users: UserType[];
  agentName: (id: string | null) => string;
}

// All possible call outcome values (from both CallOutcome and InteractionOutcome types)
const ALL_OUTCOMES = [
  'Connected/Answered',
  'Interested',
  'No Answer',
  'Not Responding',
  'Call Back Later',
  'Wrong Number',
  'Not Interested',
] as const;

// Map call outcomes to visual categories
const OUTCOME_CATEGORIES: { outcome: string; label: string; color: string; icon: typeof Phone }[] = [
  { outcome: 'Connected/Answered', label: 'Connected', color: 'bg-emerald-500', icon: CheckCircle2 },
  { outcome: 'Interested', label: 'Interested', color: 'bg-teal-500', icon: PhoneIncoming },
  { outcome: 'No Answer', label: 'No Answer', color: 'bg-amber-500', icon: PhoneMissed },
  { outcome: 'Not Responding', label: 'Not Responding', color: 'bg-orange-500', icon: PhoneMissed },
  { outcome: 'Call Back Later', label: 'Call Back Later', color: 'bg-blue-500', icon: Clock },
  { outcome: 'Wrong Number', label: 'Wrong Number', color: 'bg-red-500', icon: XCircle },
  { outcome: 'Not Interested', label: 'Not Interested', color: 'bg-rose-500', icon: XCircle },
];

function getOutcomeFromLog(log: ActivityLog): string | null {
  if (!log.detail) return null;
  const match = ALL_OUTCOMES.find((o) => log.detail!.includes(`Outcome: ${o}`));
  return match || null;
}

export default function CallPerformanceAnalytics({
  leads,
  activityLogs,
  users,
  agentName,
}: CallPerformanceAnalyticsProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Get all call-related activity logs for the filtered leads
  const callLogs = useMemo(() => {
    const leadIds = new Set(leads.map((l) => l.id));
    return activityLogs
      .filter((log) => {
        if (!leadIds.has(log.lead_id)) return false;
        const action = log.action.toLowerCase();
        return action.includes('call');
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, activityLogs]);

  // Count calls by outcome (from detail field) and from lead.call_outcome
  const outcomeStats = useMemo(() => {
    const stats = new Map<string, number>();
    for (const log of callLogs) {
      const outcome = getOutcomeFromLog(log);
      if (outcome) {
        stats.set(outcome, (stats.get(outcome) || 0) + 1);
      }
    }
    // Also count leads with call_outcome set (even if no explicit log)
    for (const lead of leads) {
      if (lead.call_outcome && !callLogs.some((log) => log.lead_id === lead.id && getOutcomeFromLog(log))) {
        stats.set(lead.call_outcome as string, (stats.get(lead.call_outcome as string) || 0) + 1);
      }
    }
    return stats;
  }, [callLogs, leads]);

  const totalCalls = useMemo(() => {
    const loggedCallCount = callLogs.length;
    const leadsWithOutcome = leads.filter((l) => l.call_outcome).length;
    return Math.max(loggedCallCount, leadsWithOutcome);
  }, [callLogs, leads]);

  const connectedCount = (outcomeStats.get('Connected/Answered') || 0) + (outcomeStats.get('Interested') || 0);
  const unansweredCount = (outcomeStats.get('No Answer') || 0) + (outcomeStats.get('Not Responding') || 0);
  const wrongNumberCount = outcomeStats.get('Wrong Number') || 0;
  const notInterestedCount = outcomeStats.get('Not Interested') || 0;
  const callBackLaterCount = outcomeStats.get('Call Back Later') || 0;

  const connectedPct = totalCalls > 0 ? Math.round((connectedCount / totalCalls) * 100) : 0;
  const unansweredPct = totalCalls > 0 ? Math.round((unansweredCount / totalCalls) * 100) : 0;

  // Follow-ups scheduled via calls: call logs that mention "Next follow-up" in detail
  const followupsScheduled = useMemo(() => {
    return callLogs.filter((log) => log.detail?.toLowerCase().includes('next follow-up')).length;
  }, [callLogs]);

  // Drill-down: leads with unanswered/not responding calls
  const unansweredLeads = useMemo(() => {
    const unansweredLeadIds = new Set<string>();
    for (const log of callLogs) {
      const outcome = getOutcomeFromLog(log);
      if (outcome === 'No Answer' || outcome === 'Not Responding') {
        unansweredLeadIds.add(log.lead_id);
      }
    }
    // Also include leads whose call_outcome is unanswered
    for (const lead of leads) {
      const co = lead.call_outcome as string | null;
      if (co === 'Not Responding' || co === 'No Answer') {
        unansweredLeadIds.add(lead.id);
      }
    }
    return leads.filter((l) => unansweredLeadIds.has(l.id));
  }, [callLogs, leads]);

  // For each unanswered lead, find the last call log timestamp
  const unansweredLeadDetails = useMemo(() => {
    return unansweredLeads
      .map((lead) => {
        const leadCallLogs = callLogs.filter((log) => log.lead_id === lead.id);
        const lastCall = leadCallLogs[0];
        const outcome = lead.call_outcome || (lastCall ? getOutcomeFromLog(lastCall) : null);
        return {
          lead,
          lastCallAt: lastCall?.created_at || lead.updated_at,
          outcome,
          callCount: leadCallLogs.length,
        };
      })
      .sort((a, b) => new Date(b.lastCallAt).getTime() - new Date(a.lastCallAt).getTime());
  }, [unansweredLeads, callLogs]);

  if (totalCalls === 0) return null;

  return (
    <>
      {/* Call Performance & Status Analytics Card */}
      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-5">
          <PhoneOutgoing size={20} className="text-[#D4AF37]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Call Performance &amp; Status Analytics</h2>
        </div>

        {/* Top call metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <CallMetricCard
            label="Total Calls"
            value={totalCalls}
            sub={`${callLogs.length} logged`}
            icon={Phone}
            color="bg-slate-100 text-slate-700"
          />
          <CallMetricCard
            label="Connected"
            value={connectedCount}
            sub={`${connectedPct}% rate`}
            icon={CheckCircle2}
            color="bg-emerald-100 text-emerald-700"
          />
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-left transition active:scale-[.98] hover:shadow-md rounded-xl"
          >
            <CallMetricCard
              label="Not Responding"
              value={unansweredCount}
              sub={`${unansweredPct}% unanswered`}
              icon={PhoneMissed}
              color="bg-orange-100 text-orange-700"
              clickable
            />
          </button>
          <CallMetricCard
            label="Follow-ups Set"
            value={followupsScheduled}
            sub="via call logging"
            icon={Clock}
            color="bg-blue-100 text-blue-700"
          />
        </div>

        {/* Call Outcome Distribution Chart */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Call Outcome Distribution</h3>
          <div className="space-y-2.5">
            {OUTCOME_CATEGORIES.map(({ outcome, label, color, icon: Icon }) => {
              const count = outcomeStats.get(outcome) || 0;
              const pct = totalCalls > 0 ? (count / totalCalls) * 100 : 0;
              if (count === 0) return null;
              return (
                <div key={outcome} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center text-white flex-shrink-0`}>
                    <Icon size={12} />
                  </div>
                  <span className="text-sm font-medium text-slate-600 w-28 lg:w-32 flex-shrink-0 truncate">{label}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${color} transition-all duration-700 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                    >
                      {count > 0 && <span className="text-[10px] font-bold text-white">{pct.toFixed(0)}%</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#0F172A] w-8 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
            {outcomeStats.size === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No call outcome data recorded yet</p>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <QuickStat label="Wrong Number" value={wrongNumberCount} color="text-red-600" />
          <QuickStat label="Not Interested" value={notInterestedCount} color="text-rose-600" />
          <QuickStat label="Call Back Later" value={callBackLaterCount} color="text-blue-600" />
          <QuickStat
            label="Unanswered Leads"
            value={unansweredLeads.length}
            color="text-orange-600"
            clickable
            onClick={() => setDrawerOpen(true)}
          />
        </div>
      </div>

      {/* Drill-down Drawer: Unanswered Calls */}
      {drawerOpen && (
        <UnansweredCallsDrawer
          leads={unansweredLeadDetails}
          agentName={agentName}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────

function CallMetricCard({
  label, value, sub, icon: Icon, color, clickable,
}: {
  label: string; value: number; sub: string; icon: typeof Phone; color: string; clickable?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3.5 ${clickable ? 'ring-1 ring-orange-200 cursor-pointer' : ''}`}>
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
        <Icon size={15} />
      </div>
      <p className="text-xl font-bold text-[#0F172A] leading-none">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{label}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickStat({ label, value, color, clickable, onClick }: { label: string; value: number; color: string; clickable?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`text-center rounded-lg p-2 ${clickable ? 'hover:bg-orange-50 cursor-pointer transition' : 'cursor-default'}`}
    >
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </button>
  );
}

interface UnansweredLeadDetail {
  lead: Lead;
  lastCallAt: string;
  outcome: string | null;
  callCount: number;
}

function UnansweredCallsDrawer({
  leads,
  agentName,
  onClose,
}: {
  leads: UnansweredLeadDetail[];
  agentName: (id: string | null) => string;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-white z-50 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneMissed size={20} className="text-orange-500" />
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Unanswered Calls</h2>
                <p className="text-xs text-slate-500">{leads.length} leads need follow-up</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Lead list */}
        <div className="p-4 space-y-3">
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-2" />
              <p className="text-sm text-slate-400">No unanswered calls in this range</p>
            </div>
          ) : (
            leads.map(({ lead, lastCallAt, outcome, callCount }) => {
              const outcomeColor = outcome
                ? (CALL_OUTCOME_COLORS[outcome as keyof typeof CALL_OUTCOME_COLORS] || 'bg-slate-100 text-slate-600 border-slate-200')
                : 'bg-slate-100 text-slate-600 border-slate-200';
              return (
                <div
                  key={lead.id}
                  className="rounded-xl border border-slate-200 p-3.5 hover:border-orange-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {lead.client_name[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0F172A] truncate">{lead.client_name}</p>
                          <p className="text-xs text-slate-500">{lead.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {outcome && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${outcomeColor}`}>
                            {outcome}
                          </span>
                        )}
                        {callCount > 1 && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {callCount} calls
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User size={10} />
                          {agentName(lead.assigned_to)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">Last call</p>
                      <p className="text-xs font-semibold text-slate-600">{formatDateTime(lastCallAt)}</p>
                      {lead.next_followup_at && (
                        <p className="text-[10px] text-blue-500 mt-1">
                          FU: {formatDateTime(lead.next_followup_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                    className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition active:scale-95"
                  >
                    <Phone size={14} />
                    Call Now
                  </a>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
