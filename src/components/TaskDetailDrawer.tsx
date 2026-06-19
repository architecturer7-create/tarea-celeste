import { useEffect, useState } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tarea, EstadoTarea, PrioridadTarea, MiembroProyecto, Perfil } from '@/lib/types';
import { ESTADO_CONFIG, PRIORIDAD_CONFIG } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { StatusDot } from '@/components/StatusDot';
import ChatAttachControls from '@/components/ChatAttachControls';
import ScreenshotAnnotator from '@/components/ScreenshotAnnotator';
import ImageLightbox from '@/components/ImageLightbox';
import { toast } from 'sonner';

interface TareaConImagen extends Tarea {
  imagen_path?: string | null;
}

interface Props {
  tarea: TareaConImagen;
  perfiles: Perfil[];
  miembros: MiembroProyecto[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailDrawer({ tarea, perfiles, miembros, onClose, onUpdate }: Props) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [descripcion, setDescripcion] = useState(tarea.descripcion || '');
  const [estado, setEstado] = useState<EstadoTarea>(tarea.estado);
  const [responsableId, setResponsableId] = useState(tarea.responsable_id || '');
  const [fechaInicio, setFechaInicio] = useState(tarea.fecha_inicio || '');
  const [fechaLimite, setFechaLimite] = useState(tarea.fecha_limite || '');
  const [seccion, setSeccion] = useState(tarea.seccion || 'General');
  const [prioridad, setPrioridad] = useState<PrioridadTarea>(tarea.prioridad || 'media');
  const [saving, setSaving] = useState(false);
  const [imagenPath, setImagenPath] = useState<string | null>(tarea.imagen_path ?? null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [annotateFile, setAnnotateFile] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const memberProfiles = miembros
    .map(m => perfiles.find(p => p.user_id === m.usuario_id))
    .filter(Boolean) as Perfil[];

  useEffect(() => {
    let cancel = false;
    if (!imagenPath) { setImagenUrl(null); return; }
    supabase.storage.from('tarea-archivos').createSignedUrl(imagenPath, 3600).then(({ data }) => {
      if (!cancel) setImagenUrl(data?.signedUrl ?? null);
    });
    return () => { cancel = true; };
  }, [imagenPath]);

  useEffect(() => {
    if (!pendingFile) { setPendingPreview(null); return; }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const save = async () => {
    setSaving(true);
    let newImagenPath: string | null | undefined = undefined;

    if (pendingFile) {
      setUploading(true);
      const ext = (pendingFile.name.split('.').pop() || 'png').toLowerCase();
      const path = `${tarea.proyecto_id}/${tarea.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('tarea-archivos').upload(path, pendingFile, {
        contentType: pendingFile.type || 'image/png',
        upsert: false,
      });
      setUploading(false);
      if (upErr) {
        toast.error('No se pudo subir la imagen');
        setSaving(false);
        return;
      }
      if (imagenPath) {
        await supabase.storage.from('tarea-archivos').remove([imagenPath]);
      }
      newImagenPath = path;
    }

    const oldEstado = tarea.estado;
    await supabase.from('tareas').update({
      titulo, descripcion: descripcion || null, estado, prioridad,
      responsable_id: responsableId || null,
      fecha_inicio: fechaInicio || null, fecha_limite: fechaLimite || null,
      seccion,
      ...(newImagenPath !== undefined ? { imagen_path: newImagenPath } : {}),
    } as never).eq('id', tarea.id);

    if (oldEstado !== estado && user) {
      await supabase.from('actividad_tareas').insert({
        tarea_id: tarea.id, usuario_id: user.id,
        accion: 'cambio_estado', valor_anterior: oldEstado, valor_nuevo: estado,
      });
    }
    setSaving(false);
    onUpdate();
    onClose();
  };

  const removeImagen = async () => {
    if (!imagenPath) { setPendingFile(null); return; }
    if (!confirm('¿Eliminar la imagen de esta tarea?')) return;
    setUploading(true);
    await supabase.storage.from('tarea-archivos').remove([imagenPath]);
    await supabase.from('tareas').update({ imagen_path: null } as never).eq('id', tarea.id);
    setImagenPath(null);
    setImagenUrl(null);
    setUploading(false);
    onUpdate();
  };

  const deleteTarea = async () => {
    await supabase.from('tareas').delete().eq('id', tarea.id);
    onUpdate();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border animate-slide-in-right overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Detalle de tarea</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="Descripción opcional..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Estado</label>
            <div className="flex gap-1.5">
              {(Object.keys(ESTADO_CONFIG) as EstadoTarea[]).map(e => (
                <button
                  key={e}
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

          {/* Priority */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Prioridad</label>
            <div className="flex gap-1.5">
              {(Object.keys(PRIORIDAD_CONFIG) as PrioridadTarea[]).map(p => (
                <button
                  key={p}
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

          {/* Assignee */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Responsable</label>
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

          {/* Section */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Sección</label>
            <input
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="General"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Fecha límite</label>
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving || !titulo.trim()}
              className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={deleteTarea}
              className="h-10 px-4 rounded-md border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-colors"
            >
              Eliminar
            </button>
          </div>

          {/* Meta */}
          <div className="pt-2 border-t border-border text-[11px] text-muted-foreground space-y-1">
            <p>Creada: {new Date(tarea.fecha_creacion).toLocaleString('es')}</p>
            <p>Actualizada: {new Date(tarea.fecha_actualizacion).toLocaleString('es')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
