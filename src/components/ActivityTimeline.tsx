import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ActivityLog, User } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { Phone, MessageCircle, Edit3, Plus, GitBranch, Trash2, CheckCircle2, History } from 'lucide-react';

interface ActivityTimelineProps {
  leadId: string;
  users: User[];
  refreshKey?: number;
}

function actionIcon(action: string): typeof Phone {
  const lower = action.toLowerCase();
  if (lower.includes('call')) return Phone;
  if (lower.includes('whatsapp')) return MessageCircle;
  if (lower.includes('created') || lower.includes('add')) return Plus;
  if (lower.includes('reassign')) return GitBranch;
  if (lower.includes('delete')) return Trash2;
  if (lower.includes('won') || lower.includes('closed')) return CheckCircle2;
  if (lower.includes('stage')) return GitBranch;
  if (lower.includes('site visit')) return CheckCircle2;
  return Edit3;
}

function actionColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('call')) return 'bg-blue-50 text-blue-600';
  if (lower.includes('whatsapp')) return 'bg-green-50 text-green-600';
  if (lower.includes('created') || lower.includes('add')) return 'bg-sky-50 text-sky-600';
  if (lower.includes('reassign') || lower.includes('stage')) return 'bg-violet-50 text-violet-600';
  if (lower.includes('delete')) return 'bg-red-50 text-red-600';
  if (lower.includes('won') || lower.includes('closed')) return 'bg-emerald-50 text-emerald-600';
  if (lower.includes('site visit')) return 'bg-emerald-50 text-emerald-600';
  return 'bg-slate-100 text-slate-600';
}

export default function ActivityTimeline({ leadId, users, refreshKey }: ActivityTimelineProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setLogs((data as ActivityLog[]) || []);
        setLoading(false);
      }
    };

    fetchLogs();

    const channel = supabase
      .channel(`activity-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs', filter: `lead_id=eq.${leadId}` }, fetchLogs)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [leadId, refreshKey]);

  const userName = (id: string | null) => {
    if (!id) return 'System';
    const u = users.find((u) => u.id === id);
    return u?.full_name || u?.username || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400">
        <History size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log, idx) => {
        const Icon = actionIcon(log.action);
        const colorClass = actionColor(log.action);
        const isCall = log.action.toLowerCase().includes('call');
        const isWhatsApp = log.action.toLowerCase().includes('whatsapp');
        const showBadge = isCall || isWhatsApp;

        return (
          <div key={log.id} className="flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} />
              </div>
              {idx < logs.length - 1 && (
                <div className="w-0.5 flex-1 bg-slate-200 my-1" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 ${idx < logs.length - 1 ? 'pb-4' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#0F172A]">{log.action}</span>
                    {showBadge && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        isCall
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-green-50 text-green-600 border-green-200'
                      }`}>
                        {isCall ? <Phone size={9} /> : <MessageCircle size={9} />}
                        {log.action}
                      </span>
                    )}
                  </div>
                  {log.detail && (
                    <p className="text-sm text-slate-600 mt-0.5 break-words">{log.detail}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{formatDateTime(log.created_at)}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-600 font-medium">{userName(log.user_id)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
