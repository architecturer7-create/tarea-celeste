import { useEffect, useState } from 'react';
import { Pencil, Trash2, ExternalLink, Loader2, Plus, ChevronDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  proyectoId: string;
  isOwner: boolean;
  externalActiveId?: string | null;
  externalAction?: 'create' | null;
  onExternalConsumed?: () => void;
}

interface MiroRow {
  id: string;
  miro_url: string;
  miro_board_id: string;
  nombre: string;
}

function parseMiroBoardId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const m = trimmed.match(/miro\.com\/app\/(?:board|live-embed)\/([A-Za-z0-9_=-]+)/i);
  if (m && m[1]) return m[1];
  const m2 = trimmed.match(/miro\.com\/[^\s]*\/([A-Za-z0-9_=-]{10,})/i);
  if (m2 && m2[1]) return m2[1];
  return null;
}

function buildEmbedUrl(boardId: string): string {
  return `https://miro.com/app/live-embed/${boardId}/?embedMode=view_only_without_ui`;
}

export default function MiroView({ proyectoId, isOwner, externalActiveId, externalAction, onExternalConsumed }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<MiroRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MiroRow | null>(null); // row being edited
  const [creating, setCreating] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [nombreInput, setNombreInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('proyecto_miro')
      .select('id, miro_url, miro_board_id, nombre')
      .eq('proyecto_id', proyectoId)
      .order('fecha_actualizacion', { ascending: true });
    const list = (data as MiroRow[] | null) ?? [];
    setRows(list);
    setActiveId(prev => {
      if (prev && list.some(r => r.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, [proyectoId]);

  // Apply external controls coming from the tab button
  useEffect(() => {
    if (externalActiveId) {
      setActiveId(externalActiveId);
      setCreating(false);
      setEditing(null);
      onExternalConsumed?.();
    }
  }, [externalActiveId]);

  useEffect(() => {
    if (externalAction === 'create') {
      setCreating(true);
      setEditing(null);
      setUrlInput('');
      setNombreInput('');
      onExternalConsumed?.();
    }
  }, [externalAction]);

  const resetForm = () => {
    setEditing(null);
    setCreating(false);
    setUrlInput('');
    setNombreInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const boardId = parseMiroBoardId(urlInput);
    if (!boardId) {
      toast.error('Enlace de Miro no válido. Pega el enlace del tablero (https://miro.com/app/board/...)');
      return;
    }
    setSaving(true);
    const payload = {
      proyecto_id: proyectoId,
      miro_url: urlInput.trim(),
      miro_board_id: boardId,
      nombre: nombreInput.trim() || 'Tablero',
      actualizado_por: user.id,
    };
    const { data, error } = editing
      ? await supabase.from('proyecto_miro').update(payload).eq('id', editing.id).select().single()
      : await supabase.from('proyecto_miro').insert(payload).select().single();
    setSaving(false);
    if (error) {
      toast.error('No se pudo guardar el tablero');
      return;
    }
    toast.success('Tablero guardado');
    if (data) setActiveId((data as MiroRow).id);
    resetForm();
    fetchRows();
  };

  const handleDelete = async (row: MiroRow) => {
    if (!confirm(`¿Quitar el tablero "${row.nombre}"?`)) return;
    const { error } = await supabase.from('proyecto_miro').delete().eq('id', row.id);
    if (error) {
      toast.error('No se pudo quitar el tablero');
      return;
    }
    toast.success('Tablero quitado');
    if (activeId === row.id) setActiveId(null);
    fetchRows();
  };

  const startEdit = (row: MiroRow) => {
    setEditing(row);
    setCreating(false);
    setUrlInput(row.miro_url);
    setNombreInput(row.nombre);
    setPickerOpen(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setUrlInput('');
    setNombreInput('');
    setPickerOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Form view (create or edit)
  if (creating || editing) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <form onSubmit={handleSave} className="w-full max-w-md space-y-3 glass-panel rounded-lg p-5">
          <h3 className="text-sm font-medium text-foreground">
            {editing ? 'Editar tablero de Miro' : 'Agregar tablero de Miro'}
          </h3>
          <input
            type="text"
            value={nombreInput}
            onChange={(e) => setNombreInput(e.target.value)}
            placeholder="Nombre del tablero (ej. Conceptual)"
            className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://miro.com/app/board/uXjV..."
            required
            autoFocus
            className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-[11px] text-muted-foreground">
            Pega el enlace del tablero (Share → Copy board link, o Share → Embed). En Miro habilita "Anyone with the link can view".
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Empty state
  if (rows.length === 0) {
    if (!isOwner) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 text-muted-foreground">
          <p className="text-sm">El propietario aún no ha configurado un tablero de Miro.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 gap-3">
        <p className="text-sm text-muted-foreground">No hay tableros de Miro configurados.</p>
        <button
          onClick={startCreate}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Agregar tablero
        </button>
      </div>
    );
  }

  const active = rows.find(r => r.id === activeId) ?? rows[0];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Selector header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/60 backdrop-blur-sm">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs bg-muted border border-border hover:bg-muted/70 transition-colors">
              <span className="font-medium text-foreground">{active.nombre}</span>
              <span className="text-muted-foreground">({rows.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1 bg-popover border-border">
            <div className="max-h-64 overflow-y-auto">
              {rows.map(r => (
                <div key={r.id} className="group flex items-center gap-1 rounded hover:bg-muted">
                  <button
                    onClick={() => { setActiveId(r.id); setPickerOpen(false); }}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs text-left"
                  >
                    <Check className={`w-3 h-3 ${r.id === active.id ? 'text-primary' : 'text-transparent'}`} />
                    <span className="truncate text-foreground">{r.nombre}</span>
                  </button>
                  {isOwner && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(r); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                        title="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity mr-1"
                        title="Quitar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {isOwner && (
              <>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={startCreate}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-foreground"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar tablero
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
        <a
          href={active.miro_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Abrir en Miro"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="flex-1 relative">
        <iframe
          key={active.id}
          src={buildEmbedUrl(active.miro_board_id)}
          className="w-full h-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
          title={`Tablero de Miro: ${active.nombre}`}
        />
      </div>
    </div>
  );
}