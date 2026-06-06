import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, Loader2, Download, Trash2, FileText, X, Bell, BellOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import type { Perfil } from '@/lib/types';
import { toast } from 'sonner';
import { enablePush, disablePush, isSubscribed, getPushStatus, isPushSupported } from '@/lib/pushNotifications';

interface ChatMensaje {
  id: string;
  proyecto_id: string;
  autor_id: string;
  contenido: string;
  archivo_path: string | null;
  archivo_nombre: string | null;
  archivo_tipo: string | null;
  archivo_tamano: number | null;
  fecha: string;
}

interface Props {
  proyectoId: string;
  perfiles: Perfil[];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(fecha: string): string {
  const d = new Date(fecha);
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(fecha: string): string {
  const d = new Date(fecha);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yest.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ConnectView({ proyectoId, perfiles }: Props) {
  const { user, perfil } = useAuth();
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMensajes = async () => {
    const { data } = await supabase
      .from('chat_mensajes' as never)
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('fecha', { ascending: true });
    setMensajes((data as ChatMensaje[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMensajes();
    const channel = supabase
      .channel(`chat-${proyectoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_mensajes', filter: `proyecto_id=eq.${proyectoId}` },
        () => fetchMensajes(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [proyectoId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes.length]);

  useEffect(() => {
    isSubscribed().then(setPushOn).catch(() => setPushOn(false));
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success('Notificaciones desactivadas');
      } else {
        const status = await getPushStatus();
        if (status === 'unsupported') {
          toast.error('Tu navegador no soporta notificaciones. En iPhone, instala la app desde Safari (Compartir → Añadir a inicio).');
          return;
        }
        const res = await enablePush();
        if (res.ok) {
          setPushOn(true);
          toast.success('Notificaciones activadas en este dispositivo');
        } else {
          toast.error(res.reason ?? 'No se pudo activar');
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const getPerfil = (userId: string) => perfiles.find(p => p.user_id === userId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!texto.trim() && !archivo) return;
    setEnviando(true);
    try {
      let archivoMeta: Partial<ChatMensaje> = {};
      if (archivo) {
        const ext = archivo.name.split('.').pop() ?? 'bin';
        const path = `${proyectoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('chat-archivos')
          .upload(path, archivo, { contentType: archivo.type || 'application/octet-stream', upsert: false });
        if (upErr) {
          toast.error('No se pudo subir el archivo');
          setEnviando(false);
          return;
        }
        archivoMeta = {
          archivo_path: path,
          archivo_nombre: archivo.name,
          archivo_tipo: archivo.type || 'application/octet-stream',
          archivo_tamano: archivo.size,
        };
      }
      const { error } = await supabase.from('chat_mensajes' as never).insert({
        proyecto_id: proyectoId,
        autor_id: user.id,
        contenido: texto.trim(),
        ...archivoMeta,
      } as never);
      if (error) {
        toast.error('No se pudo enviar el mensaje');
      } else {
        setTexto('');
        setArchivo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Fire-and-forget push notification to other members
        supabase.functions.invoke('send-push', {
          body: {
            proyecto_id: proyectoId,
            contenido: texto.trim(),
            autor_nombre: perfil?.nombre ?? 'Alguien',
            archivo_nombre: (archivoMeta as ChatMensaje).archivo_nombre ?? null,
          },
        }).catch((e) => console.warn('push failed', e));
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleDelete = async (m: ChatMensaje) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    if (m.archivo_path) {
      await supabase.storage.from('chat-archivos').remove([m.archivo_path]);
    }
    await supabase.from('chat_mensajes' as never).delete().eq('id', m.id);
  };

  const handleDownload = async (m: ChatMensaje) => {
    if (!m.archivo_path) return;
    const { data, error } = await supabase.storage
      .from('chat-archivos')
      .createSignedUrl(m.archivo_path, 60, { download: m.archivo_nombre ?? undefined });
    if (error || !data) {
      toast.error('No se pudo descargar el archivo');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const imgs = mensajes.filter(m => m.archivo_path && m.archivo_tipo?.startsWith('image/'));
    imgs.forEach(async (m) => {
      if (imageUrls[m.id] || !m.archivo_path) return;
      const { data } = await supabase.storage.from('chat-archivos').createSignedUrl(m.archivo_path, 3600);
      if (data?.signedUrl) {
        setImageUrls(prev => ({ ...prev, [m.id]: data.signedUrl }));
      }
    });
  }, [mensajes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-border bg-background/40">
        <div className="text-xs text-muted-foreground">Chat del proyecto</div>
        {isPushSupported() && (
          <button
            type="button"
            onClick={togglePush}
            disabled={pushBusy}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${
              pushOn
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            } disabled:opacity-50`}
            title={pushOn ? 'Notificaciones activadas' : 'Activar notificaciones'}
          >
            {pushBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : pushOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{pushOn ? 'Notificaciones' : 'Activar push'}</span>
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2">
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <p>Aún no hay mensajes. Sé el primero en escribir.</p>
          </div>
        )}
        {mensajes.map((m) => {
          const perfil = getPerfil(m.autor_id);
          const isMine = m.autor_id === user?.id;
          const day = formatDay(m.fecha);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {day}
                  </span>
                </div>
              )}
              <div className={`flex gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {perfil && (
                  <UserAvatar
                    nombre={perfil.nombre}
                    color={perfil.color_avatar}
                    avatarUrl={perfil.avatar_url}
                    size="sm"
                  />
                )}
                <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-0.5 px-1">
                    <span className="text-[10px] text-muted-foreground">{perfil?.nombre ?? 'Usuario'}</span>
                    <span className="text-[10px] text-muted-foreground/70">{formatTime(m.fecha)}</span>
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm border ${
                      isMine
                        ? 'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_30%,hsl(0_0%_0%)_100%)] text-primary-foreground border-transparent shadow-[0_0_10px_-4px_hsl(var(--primary)/0.5)]'
                        : 'bg-muted text-foreground border-border'
                    }`}
                  >
                    {m.archivo_path && m.archivo_tipo?.startsWith('image/') && imageUrls[m.id] && (
                      <button
                        type="button"
                        onClick={() => handleDownload(m)}
                        className="block mb-1.5"
                      >
                        <img
                          src={imageUrls[m.id]}
                          alt={m.archivo_nombre ?? 'imagen'}
                          className="rounded-lg max-h-64 object-cover"
                        />
                      </button>
                    )}
                    {m.archivo_path && !m.archivo_tipo?.startsWith('image/') && (
                      <button
                        type="button"
                        onClick={() => handleDownload(m)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 transition-colors w-full text-left ${
                          isMine ? 'bg-black/30 hover:bg-black/40' : 'bg-background hover:bg-background/70'
                        }`}
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{m.archivo_nombre}</div>
                          <div className="text-[10px] opacity-70">{formatSize(m.archivo_tamano)}</div>
                        </div>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                    {m.contenido && (
                      <div className="whitespace-pre-wrap break-words">{m.contenido}</div>
                    )}
                  </div>
                </div>
                {isMine && (
                  <button
                    onClick={() => handleDelete(m)}
                    className="opacity-0 group-hover:opacity-100 self-center p-1 text-muted-foreground hover:text-destructive transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} className="border-t border-border p-2 md:p-3 bg-background/60 backdrop-blur-sm">
        {archivo && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-muted border border-border text-xs">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="flex-1 truncate text-foreground">{archivo.name}</span>
            <span className="text-muted-foreground">{formatSize(archivo.size)}</span>
            <button
              type="button"
              onClick={() => { setArchivo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setArchivo(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Adjuntar archivo"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 resize-none min-h-10 max-h-32 px-3 py-2 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={enviando || (!texto.trim() && !archivo)}
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_30%,hsl(0_0%_0%)_100%)] text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            title="Enviar"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}