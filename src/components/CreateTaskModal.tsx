import { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MiembroProyecto, Perfil, EstadoTarea, PrioridadTarea } from '@/lib/types';
import { ESTADO_CONFIG, PRIORIDAD_CONFIG } from '@/lib/types';
import { StatusDot } from '@/components/StatusDot';
import ChatAttachControls from '@/components/ChatAttachControls';
import ScreenshotAnnotator from '@/components/ScreenshotAnnotator';
import ImageLightbox from '@/components/ImageLightbox';
import { toast } from 'sonner';

interface Props {
  proyectoId: string;
  miembros: MiembroProyecto[];
  perfiles: Perfil[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ proyectoId, miembros, perfiles, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState<EstadoTarea>('pendiente');
  const [responsableId, setResponsableId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [seccion, setSeccion] = useState('General');
  const [prioridad, setPrioridad] = useState<PrioridadTarea>('media');
  const [saving, setSaving] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [annotateFile, setAnnotateFile] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const memberProfiles = miembros
    .map(m => perfiles.find(p => p.user_id === m.usuario_id))
    .filter(Boolean) as Perfil[];

  useEffect(() => {
    if (!pendingFile) { setPendingPreview(null); return; }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !titulo.trim()) return;
    setSaving(true);

    const { data: inserted, error: insertError } = await supabase
      .from('tareas')
      .insert({
        proyecto_id: proyectoId,
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        estado,
        prioridad,
        responsable_id: responsableId || null,
        fecha_inicio: fechaInicio || null,
        fecha_limite: fechaLimite || null,
        seccion: seccion || 'General',
        creado_por: user.id,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      toast.error('Error al crear la tarea');
      setSaving(false);
      return;
    }

    const tareaId = inserted.id;

    if (pendingFile) {
      setUploading(true);
      const ext = (pendingFile.name.split('.').pop() || 'png').toLowerCase();
      const path = `${proyectoId}/${tareaId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('tarea-archivos').upload(path, pendingFile, {
        contentType: pendingFile.type || 'image/png',
        upsert: false,
      });
      setUploading(false);
      if (upErr) {
        toast.error('Tarea creada, pero no se pudo subir la imagen');
      } else {
        await supabase.from('tareas').update({ imagen_path: path }).eq('id', tareaId);
      }
    }

    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-panel rounded-t-xl md:rounded-lg p-5 w-full max-w-lg animate-fade-in max-h-[85vh] overflow-y-auto safe-bottom">
        <h3 className="text-base font-medium text-foreground mb-4">Nueva tarea</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Título *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              autoFocus
              className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Nombre de la tarea"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="Opcional..."
            />
          </div>

          {/* Imagen */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Imagen</label>
            {pendingPreview ? (
              <div className="relative rounded-md overflow-hidden border border-border bg-muted mb-2">
                <button
                  type="button"
                  onClick={() => setLightbox(pendingPreview)}
                  className="block w-full"
                >
                  <img
                    src={pendingPreview}
                    alt="Vista previa"
                    className="w-full max-h-64 object-contain cursor-zoom-in"
                  />
                </button>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    disabled={uploading}
                    className="h-8 w-8 rounded-md bg-background/80 backdrop-blur border border-border text-destructive hover:bg-background flex items-center justify-center"
                    title="Descartar imagen"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <ChatAttachControls
                onFile={(f) => setPendingFile(f)}
                onAnnotate={(f) => setAnnotateFile(f)}
                imageOnly
                disabled={uploading || saving}
              />
              <span className="text-[11px] text-muted-foreground">
                Adjunta una imagen o captura tu pantalla
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Estado</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(ESTADO_CONFIG) as EstadoTarea[]).map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstado(e)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    estado === e ? 'bg-muted border border-border text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <StatusDot estado={e} />
                  {ESTADO_CONFIG[e].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Prioridad</label>
            <div className="flex gap-1.5">
              {(Object.keys(PRIORIDAD_CONFIG) as PrioridadTarea[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrioridad(p)}
                  className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                    prioridad === p ? PRIORIDAD_CONFIG[p].className : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                >
                  {PRIORIDAD_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Responsable</label>
              <select
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Sin asignar</option>
                {memberProfiles.map(p => (
                  <option key={p.user_id} value={p.user_id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Sección</label>
              <input
                value={seccion}
                onChange={(e) => setSeccion(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="General"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Fecha límite</label>
              <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !titulo.trim()} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Creando...' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>

      {annotateFile && (
        <ScreenshotAnnotator
          imageFile={annotateFile}
          onCancel={() => setAnnotateFile(null)}
          onConfirm={(f) => { setPendingFile(f); setAnnotateFile(null); }}
        />
      )}
      {lightbox && <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
