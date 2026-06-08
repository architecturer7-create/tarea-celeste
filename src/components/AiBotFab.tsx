import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Loader2, X, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Msg { role: 'user' | 'assistant'; content: string; }

interface Props {
  proyectoId: string;
  onTasksCreated?: () => void;
}

const SUGGESTIONS = [
  'Dame el resumen semanal del proyecto',
  'Resumen de la sección Sheets',
  '¿Qué hay en el timeline esta semana?',
  '¿Tareas bloqueadas o vencidas?',
  '¿De qué se habló en el chat?',
  'Crea una tarea: revisar planos para mañana',
];

export default function AiBotFab({ proyectoId, onTasksCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const storageKey = `ai-bot-${proyectoId}`;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, storageKey]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const newMessages: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-bot', {
        body: { proyecto_id: proyectoId, messages: newMessages },
      });
      if (error) {
        toast.error(error.message || 'Error del bot');
        setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Error: ' + (error.message || 'sin respuesta') }]);
      } else if (data?.error) {
        toast.error(data.error);
        setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ ' + data.error }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? '(sin respuesta)' }]);
        if (data?.tareasCreadas?.length > 0) onTasksCreated?.();
      }
    } catch (e: any) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setMessages([]);
    try { sessionStorage.removeItem(storageKey); } catch {}
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-13 w-13 md:h-14 md:w-14 rounded-full flex items-center justify-center bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_30%,hsl(0_0%_0%)_100%)] text-primary-foreground shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.6)] hover:scale-105 transition-transform"
          style={{ height: '3.25rem', width: '3.25rem' }}
          title="Asistente IA"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end p-0 md:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:w-[420px] h-[85vh] md:h-[640px] md:max-h-[80vh] bg-card border border-border md:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[linear-gradient(135deg,hsl(var(--primary)/0.15)_0%,transparent_100%)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(0_0%_0%)_100%)] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">Asistente IA</div>
                  <div className="text-[10px] text-muted-foreground">Resúmenes · dudas · crear tareas</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clear} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted" title="Limpiar conversación">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted" title="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-3 py-4">
                  <div className="text-center text-xs text-muted-foreground">¿En qué te ayudo con este proyecto?</div>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm border ${
                        m.role === 'user'
                          ? 'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_30%,hsl(0_0%_0%)_100%)] text-primary-foreground border-transparent'
                          : 'bg-muted text-foreground border-border'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0 [&_strong]:text-foreground">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-muted-foreground border border-border rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando…
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="border-t border-border p-2 bg-background/60"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Pregunta o pide una tarea…"
                  rows={1}
                  className="flex-1 resize-none min-h-10 max-h-32 px-3 py-2 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(0_0%_0%)_100%)] text-primary-foreground disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}