import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Users, Download, FileText, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import type { Perfil } from '@/lib/types';
import { toast } from 'sonner';
import ChatAttachControls from '@/components/ChatAttachControls';
import ScreenshotAnnotator from '@/components/ScreenshotAnnotator';

interface Conv {
  id: string;
  tipo: 'directo' | 'grupo';
  nombre: string | null;
}

interface Msg {
  id: string;
  conversacion_id: string;
  autor_id: string;
  contenido: string | null;
  fecha: string;
  archivo_path?: string | null;
  archivo_nombre?: string | null;
  archivo_tipo?: string | null;
  archivo_tamano?: number | null;
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

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/gi;

function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX) ?? [];
  return Array.from(new Set(matches));
}

function renderTextWithLinks(text: string, isMine: boolean): React.ReactNode {
  // Strip URLs from text (they become preview cards). If only URLs, render nothing.
  const stripped = text.replace(URL_REGEX, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!stripped) return null;
  // Render remaining text plain (no URLs left, but keep helper signature)
  void isMine;
  return <span>{stripped}</span>;
}

function LinkPreviewCard({ url, isMine }: { url: string; isMine: boolean }) {
  let host = url;
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, '');
    path = (u.pathname + u.search).replace(/\/$/, '');
    if (path.length > 40) path = path.slice(0, 38) + '…';
  } catch { /* noop */ }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-1.5 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors w-full text-left no-underline ${
        isMine ? 'bg-black/30 hover:bg-black/40' : 'bg-background hover:bg-background/70 border border-border'
      }`}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
        alt=""
        className="w-4 h-4 rounded-sm shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{host}</div>
        {path && <div className="text-[10px] opacity-70 truncate">{path}</div>}
      </div>
      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
    </a>
  );
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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [annotateFile, setAnnotateFile] = useState<File | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
      .then(() => {
        window.dispatchEvent(new CustomEvent('chat-seen', { detail: { conversacionId: id } }));
      });
  }, [id, user?.id, msgs.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length]);

  // Signed URLs for image previews
  useEffect(() => {
    const imgs = msgs.filter(m => m.archivo_path && m.archivo_tipo?.startsWith('image/'));
    imgs.forEach(async (m) => {
      if (imageUrls[m.id] || !m.archivo_path) return;
      const { data } = await supabase.storage.from('conversacion-archivos').createSignedUrl(m.archivo_path, 3600);
      if (data?.signedUrl) setImageUrls(prev => ({ ...prev, [m.id]: data.signedUrl }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs]);

  const handleDownload = async (m: Msg) => {
    if (!m.archivo_path) return;
    const { data, error } = await supabase.storage
      .from('conversacion-archivos')
      .createSignedUrl(m.archivo_path, 60, { download: m.archivo_nombre ?? undefined });
    if (error || !data) { toast.error('No se pudo descargar el archivo'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const getPerfil = (uid: string) => miembros.find(p => p.user_id === uid);
  const otroDirecto = conv?.tipo === 'directo' ? miembros.find(p => p.user_id !== user?.id) : null;
  const titulo = conv?.tipo === 'grupo' ? (conv?.nombre ?? 'Grupo') : (otroDirecto?.nombre ?? 'Chat');
  const subtitulo = conv?.tipo === 'grupo' ? `${miembros.length} miembros` : (otroDirecto?.email ?? '');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (!texto.trim() && !archivo) return;
    setEnviando(true);
    try {
      let archivoMeta: Record<string, unknown> = {};
      if (archivo) {
        const ext = archivo.name.split('.').pop() ?? 'bin';
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('conversacion-archivos')
          .upload(path, archivo, { contentType: archivo.type || 'application/octet-stream', upsert: false });
        if (upErr) { toast.error('No se pudo subir el archivo'); return; }
        archivoMeta = {
          archivo_path: path,
          archivo_nombre: archivo.name,
          archivo_tipo: archivo.type || 'application/octet-stream',
          archivo_tamano: archivo.size,
        };
      }
      const { error } = await supabase.from('mensajes_conversacion' as never).insert({
        conversacion_id: id,
        autor_id: user.id,
        contenido: texto.trim() || null,
        ...archivoMeta,
      } as never);
      if (error) toast.error('No se pudo enviar');
      else { setTexto(''); setArchivo(null); }
    } finally {
      setEnviando(false);
    }
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2 w-full">
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
              <div className={`flex gap-2 w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {p && <UserAvatar nombre={p.nombre} color={p.color_avatar} avatarUrl={p.avatar_url} size="sm" />}
                <div className={`min-w-0 max-w-[85%] sm:max-w-[78%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[55%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {conv.tipo === 'grupo' && (
                    <div className="flex items-center gap-2 mb-0.5 px-1">
                      <span className="text-[10px] text-muted-foreground">{p?.nombre ?? 'Usuario'}</span>
                      <span className="text-[10px] text-muted-foreground/70">{formatTime(m.fecha)}</span>
                    </div>
                  )}
                  {conv.tipo === 'directo' && (
                    <span className="text-[10px] text-muted-foreground/70 mb-0.5 px-1">{formatTime(m.fecha)}</span>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm border whitespace-pre-wrap break-words w-full ${
                    isMine
                      ? 'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_30%,hsl(0_0%_0%)_100%)] text-primary-foreground border-transparent shadow-[0_0_10px_-4px_hsl(var(--primary)/0.5)]'
                      : 'bg-muted text-foreground border-border'
                  }`}>
                    {m.archivo_path && m.archivo_tipo?.startsWith('image/') && imageUrls[m.id] && (
                      <div className="mb-1.5">
                        <button type="button" onClick={() => setLightboxUrl(imageUrls[m.id])} className="block">
                          <img src={imageUrls[m.id]} alt={m.archivo_nombre ?? 'imagen'} className="rounded-lg max-h-64 w-auto object-contain cursor-zoom-in" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(m)}
                          className={`mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors ${
                            isMine ? 'bg-black/30 hover:bg-black/40' : 'bg-background hover:bg-background/70 border border-border'
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          Descargar
                        </button>
                      </div>
                    )}
                    {m.archivo_path && !m.archivo_tipo?.startsWith('image/') && (
                      <button type="button" onClick={() => handleDownload(m)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 transition-colors w-full text-left ${
                          isMine ? 'bg-black/30 hover:bg-black/40' : 'bg-background hover:bg-background/70'
                        }`}>
                        <FileText className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{m.archivo_nombre}</div>
                          <div className="text-[10px] opacity-70">{formatSize(m.archivo_tamano)}</div>
                        </div>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                    {m.contenido && renderTextWithLinks(m.contenido, isMine)}
                    {extractUrls(m.contenido).slice(0, 3).map((u) => (
                      <LinkPreviewCard key={u} url={u} isMine={isMine} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={enviar} className="border-t border-border p-2 md:p-3 bg-background/60 backdrop-blur-sm">
        {archivo && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-muted border border-border text-xs">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="flex-1 truncate text-foreground">{archivo.name}</span>
            <span className="text-muted-foreground">{formatSize(archivo.size)}</span>
            <button type="button" onClick={() => setArchivo(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <ChatAttachControls
            onFile={(f) => setArchivo(f)}
            onAnnotate={(f) => setAnnotateFile(f)}
            disabled={enviando}
          />
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
          disabled={enviando || (!texto.trim() && !archivo)}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90"
          aria-label="Enviar"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {annotateFile && (
        <ScreenshotAnnotator
          imageFile={annotateFile}
          onCancel={() => setAnnotateFile(null)}
          onConfirm={(f) => { setArchivo(f); setAnnotateFile(null); }}
        />
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-background/20 hover:bg-background/30 text-white"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Vista previa"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}