import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import type { Perfil } from '@/lib/types';
import { toast } from 'sonner';

interface Conv {
  id: string;
  tipo: 'directo' | 'grupo';
  nombre: string | null;
}

interface Msg {
  id: string;
  conversacion_id: string;
  autor_id: string;
  contenido: string;
  fecha: string;
}

function formatTime(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
function formatDay(fecha: string): string {
  const d = new Date(fecha); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conv, setConv] = useState<Conv | null>(null);
  const [miembros, setMiembros] = useState<Perfil[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!id) return;
    const [{ data: convData }, { data: msgsData }, { data: memberRows }] = await Promise.all([
      supabase.from('conversaciones' as never).select('*').eq('id', id).maybeSingle(),
      supabase.from('mensajes_conversacion' as never).select('*').eq('conversacion_id', id).order('fecha', { ascending: true }),
      supabase.from('miembros_conversacion' as never).select('usuario_id').eq('conversacion_id', id),
    ]);
    setConv((convData as Conv | null) ?? null);
    setMsgs((msgsData as Msg[] | null) ?? []);
    const ids = ((memberRows as { usuario_id: string }[] | null) ?? []).map(r => r.usuario_id);
    if (ids.length) {
      const { data: perfilesData } = await supabase.from('perfiles').select('*').in('user_id', ids);
      setMiembros((perfilesData as Perfil[] | null) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (!id) return;
    const ch = supabase
      .channel(`conv-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_conversacion', filter: `conversacion_id=eq.${id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Marcar como leído
  useEffect(() => {
    if (!id || !user) return;
    supabase.from('miembros_conversacion' as never)
      .update({ fecha_ultima_lectura: new Date().toISOString() } as never)
      .eq('conversacion_id', id).eq('usuario_id', user.id)
      .then(() => {});
  }, [id, user?.id, msgs.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length]);

  const getPerfil = (uid: string) => miembros.find(p => p.user_id === uid);
  const otroDirecto = conv?.tipo === 'directo' ? miembros.find(p => p.user_id !== user?.id) : null;
  const titulo = conv?.tipo === 'grupo' ? (conv?.nombre ?? 'Grupo') : (otroDirecto?.nombre ?? 'Chat');
  const subtitulo = conv?.tipo === 'grupo' ? `${miembros.length} miembros` : (otroDirecto?.email ?? '');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !texto.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from('mensajes_conversacion' as never).insert({
      conversacion_id: id, autor_id: user.id, contenido: texto.trim(),
    } as never);
    if (error) toast.error('No se pudo enviar');
    else setTexto('');
    setEnviando(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /></div>;
  }
  if (!conv) {
    return <div className="text-center text-sm text-muted-foreground py-16">Conversación no encontrada.</div>;
  }

  let lastDay = '';

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-3 py-2 border-b border-border bg-background/40">
        <button onClick={() => navigate('/mensajes')} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Volver">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {conv.tipo === 'directo' && otroDirecto ? (
          <UserAvatar nombre={otroDirecto.nombre} color={otroDirecto.color_avatar} avatarUrl={otroDirecto.avatar_url} size="md" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/15 text-primary border border-primary/30">
            <Users className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{titulo}</div>
          <div className="text-[11px] text-muted-foreground truncate">{subtitulo}</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2">
        {msgs.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">Aún no hay mensajes. Sé el primero en escribir.</div>
        )}
        {msgs.map((m) => {
          const p = getPerfil(m.autor_id);
          const isMine = m.autor_id === user?.id;
          const day = formatDay(m.fecha);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{day}</span>
                </div>
              )}
              <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {p && <UserAvatar nombre={p.nombre} color={p.color_avatar} avatarUrl={p.avatar_url} size="sm" />}
                <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {conv.tipo === 'grupo' && (
                    <div className="flex items-center gap-2 mb-0.5 px-1">
                      <span className="text-[10px] text-muted-foreground">{p?.nombre ?? 'Usuario'}</span>
                      <span className="text-[10px] text-muted-foreground/70">{formatTime(m.fecha)}</span>
                    </div>
                  )}
                  {conv.tipo === 'directo' && (
                    <span className="text-[10px] text-muted-foreground/70 mb-0.5 px-1">{formatTime(m.fecha)}</span>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm border whitespace-pre-wrap break-words ${
                    isMine
                      ? 'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_30%,hsl(0_0%_0%)_100%)] text-primary-foreground border-transparent shadow-[0_0_10px_-4px_hsl(var(--primary)/0.5)]'
                      : 'bg-muted text-foreground border-border'
                  }`}>
                    {m.contenido}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={enviar} className="border-t border-border p-2 md:p-3 bg-background/60 backdrop-blur-sm flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e as unknown as React.FormEvent); } }}
          placeholder="Escribe un mensaje"
          rows={1}
          className="flex-1 resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary max-h-32"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90"
          aria-label="Enviar"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}