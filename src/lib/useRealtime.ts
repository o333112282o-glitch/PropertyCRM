import { useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';

/**
 * Subscribes to realtime changes on the `leads` and `activity_logs` tables.
 * When any change is detected, calls `onChange` so the component can re-fetch.
 *
 * Uses a single shared channel name so multiple components don't create
 * duplicate subscriptions — Supabase deduplicates by channel name.
 */
export function useRealtimeLeads(onChange: () => void) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    channel.current = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        callbackRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        callbackRef.current();
      })
      .subscribe();

    return () => {
      if (channel.current) {
        supabase.removeChannel(channel.current);
        channel.current = null;
      }
    };
  }, []);
}

/**
 * Debounced fetch helper — coalesces rapid-fire realtime events into a single
 * re-fetch to avoid hammering the database with one query per event.
 */
export function useDebouncedRealtimeLeads(onChange: () => void, delay = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange();
    }, delay);
  }, [onChange, delay]);

  useRealtimeLeads(debounced);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
