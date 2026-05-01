import { useEffect, useState } from 'react';
import { Pencil, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  proyectoId: string;
  isOwner: boolean;
}

interface MiroRow {
  id: string;
  miro_url: string;
  miro_board_id: string;
}

function parseMiroBoardId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Matches /app/board/<id>/  or  /app/live-embed/<id>/  or  /app/board/<id>?...
  const m = trimmed.match(/miro\.com\/app\/(?:board|live-embed)\/([A-Za-z0-9_=-]+)/i);
  if (m && m[1]) return m[1];
  // Fallback: short share urls like https://miro.com/welcomeonboard/<token>/<id>
  const m2 = trimmed.match(/miro\.com\/[^\s]*\/([A-Za-z0-9_=-]{10,})/i);
  if (m2 && m2[1]) return m2[1];
  return null;
}

function buildEmbedUrl(boardId: string): string {
  return `https://miro.com/app/live-embed/${boardId}/?embedMode=view_only_without_ui`;
}

export default function MiroView({ proyectoId, isOwner }: Props) {
  const { user } = useAuth();
  const [row, setRow] = useState<MiroRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRow = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('proyecto_miro')
      .select('id, miro_url, miro_board_id')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    setRow((data as MiroRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { fetchRow(); }, [proyectoId]);

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
      actualizado_por: user.id,
    };
    const { error } = row
      ? await supabase.from('proyecto_miro').update(payload).eq('id', row.id)
      : await supabase.from('proyecto_miro').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('No se pudo guardar el tablero');
      return;
    }
    toast.success('Tablero de Miro guardado');
    setEditing(false);
    setUrlInput('');
    fetchRow();
  };

  const handleDelete = async () => {
    if (!row) return;
    if (!confirm('¿Quitar el tablero de Miro de este proyecto?')) return;
    const { error } = await supabase.from('proyecto_miro').delete().eq('id', row.id);
    if (error) {
      toast.error('No se pudo quitar el tablero');
      return;
    }
    toast.success('Tablero quitado');
    setRow(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Configuration / empty state
  if (!row || editing) {
    if (!isOwner && !row) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 text-muted-foreground">
          <p className="text-sm">El propietario aún no ha configurado un tablero de Miro.</p>
        </div>
      );
    }
    if (!isOwner) {
      // member shouldn't be able to edit; fall back to view
      setEditing(false);
      return null;
    }
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <form onSubmit={handleSave} className="w-full max-w-md space-y-3 glass-panel rounded-lg p-5">
          <h3 className="text-sm font-medium text-foreground">
            {row ? 'Cambiar tablero de Miro' : 'Conectar tablero de Miro'}
          </h3>
          <p className="text-xs text-muted-foreground">
            Pega el enlace del tablero (Share → Copy board link, o Share → Embed).
          </p>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://miro.com/app/board/uXjV..."
            required
            autoFocus
            className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-2">
            {row && (
              <button
                type="button"
                onClick={() => { setEditing(false); setUrlInput(''); }}
                className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Si no se ve el tablero, en Miro habilita "Anyone with the link can view" o "Embed".
          </p>
        </form>
      </div>
    );
  }

  // Embedded board
  return (
    <div className="relative w-full h-full">
      <iframe
        src={buildEmbedUrl(row.miro_board_id)}
        className="w-full h-full border-0"
        allow="fullscreen; clipboard-read; clipboard-write"
        allowFullScreen
        title="Tablero de Miro"
      />
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-md px-1 py-0.5">
        <a
          href={row.miro_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Abrir en Miro"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        {isOwner && (
          <>
            <button
              onClick={() => { setUrlInput(row.miro_url); setEditing(true); }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Cambiar enlace"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Quitar tablero"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}