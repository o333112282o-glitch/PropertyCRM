import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Lead, User, getPresence } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

export interface AppNotification {
  id: string;
  type: 'follow_up' | 'lead_assigned' | 'overdue';
  title: string;
  body: string;
  leadId?: string;
  createdAt: number;
  read: boolean;
}

export function useNotifications() {
  const { user, isAgent } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateNotifications = useCallback(async () => {
    if (!user) return;

    let query = supabase.from('leads').select('*');
    if (isAgent) {
      query = query.eq('assigned_to', user.id);
    }
    const { data: leadData } = await query.order('updated_at', { ascending: false });
    const leads = (leadData as Lead[]) || [];

    const { data: userData } = await supabase.from('users').select('*');
    const users = (userData as User[]) || [];

    const now = Date.now();
    const newNotifs: AppNotification[] = [];

    for (const lead of leads) {
      if (['Won', 'Lost'].includes(lead.stage)) continue;
      if (!lead.next_followup_at) continue;

      const followupTime = new Date(lead.next_followup_at).getTime();
      const diffMin = (followupTime - now) / 60000;

      if (diffMin <= 15 && diffMin > -60) {
        newNotifs.push({
          id: `followup-${lead.id}`,
          type: 'follow_up',
          title: 'Follow-up Reminder',
          body: `${lead.client_name} — follow-up in ${Math.max(0, Math.round(diffMin))} min`,
          leadId: lead.id,
          createdAt: now - 1000,
          read: false,
        });
      } else if (diffMin <= -60) {
        newNotifs.push({
          id: `overdue-${lead.id}`,
          type: 'overdue',
          title: 'Overdue Follow-up',
          body: `${lead.client_name} — follow-up was ${Math.round(-diffMin / 60)}h ago`,
          leadId: lead.id,
          createdAt: now - 2000,
          read: false,
        });
      }
    }

    // New lead assignments (created in last 10 min)
    for (const lead of leads) {
      const createdTime = new Date(lead.created_at).getTime();
      const ageMin = (now - createdTime) / 60000;
      if (ageMin < 10 && lead.assigned_to === user.id && isAgent) {
        newNotifs.push({
          id: `assigned-${lead.id}`,
          type: 'lead_assigned',
          title: 'New Lead Assigned',
          body: `${lead.client_name} (${lead.phone}) has been assigned to you`,
          leadId: lead.id,
          createdAt: createdTime,
          read: false,
        });
      }
    }

    newNotifs.sort((a, b) => b.createdAt - a.createdAt);
    setNotifications(newNotifs);
  }, [user, isAgent]);

  useEffect(() => {
    if (!user) return;
    generateNotifications();

    // Re-check every 2 minutes
    checkTimer.current = setInterval(generateNotifications, 120000);

    // Also re-check when the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        generateNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (checkTimer.current) clearInterval(checkTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, generateNotifications]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Fire native notifications for new unread items
  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (permission !== 'granted') return;
    for (const notif of notifications) {
      if (!notif.read && !firedRef.current.has(notif.id)) {
        firedRef.current.add(notif.id);
        try {
          new Notification(notif.title, { body: notif.body, tag: notif.id });
        } catch {
          // ignore
        }
      }
    }
  }, [notifications, permission]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, permission, requestPermission, markAllRead, refresh: generateNotifications };
}
