import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function lastSeenKey(proyectoId: string, userId: string) {
  return `chat-last-seen:${proyectoId}:${userId}`;
}

export function getLastSeen(proyectoId: string, userId: string): string {
  try { return localStorage.getItem(lastSeenKey(proyectoId, userId)) ?? '1970-01-01T00:00:00Z'; }
  catch { return '1970-01-01T00:00:00Z'; }
}

export function markChatSeen(proyectoId: string, userId: string) {
  try {
    localStorage.setItem(lastSeenKey(proyectoId, userId), new Date().toISOString());
    window.dispatchEvent(new CustomEvent('chat-seen', { detail: { proyectoId } }));
  } catch {}
}

export function useUnreadChat(proyectoId: string | null, userId: string | null, active: boolean) {
  const [unread, setUnread] = useState(0);

  const recount = async () => {
    if (!proyectoId || !userId) { setUnread(0); return; }
    const since = getLastSeen(proyectoId, userId);
    const { count } = await supabase
      .from('chat_mensajes' as never)
      .select('id', { count: 'exact', head: true })
      .eq('proyecto_id', proyectoId)
      .neq('autor_id', userId)
      .gt('fecha', since);
    setUnread(count ?? 0);
  };

  useEffect(() => {
    if (!proyectoId || !userId) return;
    if (active) { markChatSeen(proyectoId, userId); setUnread(0); return; }
    recount();
    const channel = supabase
      .channel(`unread-${proyectoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `proyecto_id=eq.${proyectoId}` },
        () => recount(),
      )
      .subscribe();
    const onSeen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.proyectoId === proyectoId) setUnread(0);
    };
    window.addEventListener('chat-seen', onSeen);
    return () => { supabase.removeChannel(channel); window.removeEventListener('chat-seen', onSeen); };
  }, [proyectoId, userId, active]);

  return unread;
}