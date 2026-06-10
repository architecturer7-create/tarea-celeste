import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getLastSeen } from '@/hooks/useUnreadChat';

interface ConvMeta {
  id: string;
  tipo: 'directo' | 'grupo';
  nombre: string | null;
}

interface ProyectoMeta {
  id: string;
  nombre: string;
}

function useCurrentContext() {
  const location = useLocation();
  const convMatch = location.pathname.match(/^\/mensajes\/([^/]+)/);
  const proyectoMatch = location.pathname.match(/^\/proyecto\/([^/]+)/);
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  return {
    activeConvId: convMatch ? convMatch[1] : null,
    activeProjectConnectId: proyectoMatch && tab === 'connect' ? proyectoMatch[1] : null,
  };
}

export function useGlobalUnread() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeConvId, activeProjectConnectId } = useCurrentContext();
  const [count, setCount] = useState(0);

  // refs so the realtime callback always sees latest values
  const activeConvIdRef = useRef(activeConvId);
  const activeProjectConnectIdRef = useRef(activeProjectConnectId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { activeProjectConnectIdRef.current = activeProjectConnectId; }, [activeProjectConnectId]);

  const convMetaRef = useRef<Map<string, ConvMeta>>(new Map());
  const proyectoMetaRef = useRef<Map<string, ProyectoMeta>>(new Map());
  const perfilesRef = useRef<Map<string, { nombre: string }>>(new Map());
  const lastToastRef = useRef<Map<string, number>>(new Map());

  const recount = async () => {
    if (!user) { setCount(0); return; }
    let total = 0;

    // Conversaciones globales
    const { data: myMemberships } = await supabase
      .from('miembros_conversacion' as never)
      .select('conversacion_id, fecha_ultima_lectura')
      .eq('usuario_id', user.id);
    const memberships = (myMemberships as { conversacion_id: string; fecha_ultima_lectura: string }[] | null) ?? [];

    for (const m of memberships) {
      if (m.conversacion_id === activeConvIdRef.current) continue;
      const { count: c } = await supabase
        .from('mensajes_conversacion' as never)
        .select('id', { count: 'exact', head: true })
        .eq('conversacion_id', m.conversacion_id)
        .neq('autor_id', user.id)
        .gt('fecha', m.fecha_ultima_lectura ?? '1970-01-01');
      total += c ?? 0;
    }

    // Connect de proyectos
    const { data: myProjects } = await supabase
      .from('miembros_proyecto')
      .select('proyecto_id')
      .eq('usuario_id', user.id);
    const projectIds = ((myProjects as { proyecto_id: string }[] | null) ?? []).map(p => p.proyecto_id);

    for (const pid of projectIds) {
      if (pid === activeProjectConnectIdRef.current) continue;
      const since = getLastSeen(pid, user.id);
      const { count: c } = await supabase
        .from('chat_mensajes' as never)
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_id', pid)
        .neq('autor_id', user.id)
        .gt('fecha', since);
      total += c ?? 0;
    }

    setCount(total);
  };

  const loadMeta = async () => {
    if (!user) return;
    const [{ data: convs }, { data: projs }, { data: perfiles }] = await Promise.all([
      supabase.from('conversaciones' as never).select('id, tipo, nombre, creado_por'),
      supabase.from('proyectos').select('id, nombre'),
      supabase.from('perfiles').select('user_id, nombre'),
    ]);
    const cm = new Map<string, ConvMeta>();
    ((convs as ConvMeta[] | null) ?? []).forEach(c => cm.set(c.id, c));
    convMetaRef.current = cm;
    const pm = new Map<string, ProyectoMeta>();
    ((projs as ProyectoMeta[] | null) ?? []).forEach(p => pm.set(p.id, p));
    proyectoMetaRef.current = pm;
    const um = new Map<string, { nombre: string }>();
    ((perfiles as { user_id: string; nombre: string }[] | null) ?? []).forEach(p => um.set(p.user_id, { nombre: p.nombre }));
    perfilesRef.current = um;
  };

  const showToast = (opts: {
    key: string;
    titulo: string;
    autorNombre: string;
    contenido: string;
    navTo: string;
  }) => {
    const now = Date.now();
    const last = lastToastRef.current.get(opts.key) ?? 0;
    if (now - last < 5000) return; // throttle por conversación
    lastToastRef.current.set(opts.key, now);
    const preview = opts.contenido.length > 80 ? `${opts.contenido.slice(0, 80)}…` : opts.contenido;
    toast(opts.titulo, {
      description: `${opts.autorNombre}: ${preview}`,
      action: { label: 'Ver', onClick: () => navigate(opts.navTo) },
      duration: 6000,
    });
  };

  useEffect(() => {
    if (!user) { setCount(0); return; }
    let cancelled = false;

    (async () => {
      await loadMeta();
      if (cancelled) return;
      await recount();
    })();

    const ch = supabase
      .channel(`global-unread-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes_conversacion' },
        async (payload) => {
          const row = payload.new as { conversacion_id: string; autor_id: string; contenido: string };
          if (row.autor_id === user.id) return;
          // Comprobar membresía vía cache; si no está, recargar meta
          if (!convMetaRef.current.has(row.conversacion_id)) {
            await loadMeta();
          }
          const meta = convMetaRef.current.get(row.conversacion_id);
          if (!meta) return; // no soy miembro
          const isActive = row.conversacion_id === activeConvIdRef.current;
          if (!isActive) {
            const autor = perfilesRef.current.get(row.autor_id)?.nombre ?? 'Alguien';
            const titulo = meta.tipo === 'grupo' ? (meta.nombre ?? 'Grupo') : autor;
            showToast({
              key: `conv-${row.conversacion_id}`,
              titulo,
              autorNombre: meta.tipo === 'grupo' ? autor : 'Nuevo mensaje',
              contenido: row.contenido,
              navTo: `/mensajes/${row.conversacion_id}`,
            });
          }
          recount();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensajes' },
        async (payload) => {
          const row = payload.new as { proyecto_id: string; autor_id: string; contenido: string };
          if (row.autor_id === user.id) return;
          if (!proyectoMetaRef.current.has(row.proyecto_id)) {
            await loadMeta();
          }
          const meta = proyectoMetaRef.current.get(row.proyecto_id);
          if (!meta) return;
          const isActive = row.proyecto_id === activeProjectConnectIdRef.current;
          if (!isActive) {
            const autor = perfilesRef.current.get(row.autor_id)?.nombre ?? 'Alguien';
            showToast({
              key: `proy-${row.proyecto_id}`,
              titulo: meta.nombre,
              autorNombre: autor,
              contenido: row.contenido,
              navTo: `/proyecto/${row.proyecto_id}?tab=connect`,
            });
          }
          recount();
        },
      )
      .subscribe();

    const onSeen = () => recount();
    window.addEventListener('chat-seen', onSeen);

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      window.removeEventListener('chat-seen', onSeen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Recount al cambiar de ruta (la conversación abierta deja de contar)
  useEffect(() => {
    if (!user) return;
    recount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, activeProjectConnectId, user?.id]);

  return count;
}