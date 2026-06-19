import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, User as UserIcon, Folder, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import NewChatModal from '@/components/NewChatModal';
import NewGroupModal from '@/components/NewGroupModal';
import type { Perfil, Proyecto } from '@/lib/types';
import { getLastSeen } from '@/hooks/useUnreadChat';

interface Conversacion {
  id: string;
  tipo: 'directo' | 'grupo';
  nombre: string | null;
  creado_por: string;
  fecha_ultimo_mensaje: string;
}

interface MiembroConv {
  conversacion_id: string;
  usuario_id: string;
  fecha_ultima_lectura: string;
}

interface UltimoMensaje {
  conversacion_id: string;
  autor_id: string;
  contenido: string;
  fecha: string;
}

interface UnreadAgg {
  ultimo?: UltimoMensaje;
  noLeidos: number;
}

type Item =
  | {
      kind: 'conv';
      id: string;
      tipo: 'directo' | 'grupo';
      titulo: string;
      subtitulo: string;
      fecha: string;
      noLeidos: number;
      avatarPerfil?: Perfil | null;
      colorGrupo?: string;
      navTo: string;
    }
  | {
      kind: 'proyecto';
      id: string;
      titulo: string;
      subtitulo: string;
      fecha: string;
      noLeidos: number;
      color: string;
      navTo: string;
    };

function formatHora(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [convs, setConvs] = useState<Conversacion[]>([]);
  const [miembros, setMiembros] = useState<MiembroConv[]>([]);
  const [ultimos, setUltimos] = useState<Record<string, UltimoMensaje>>({});
  const [convUnread, setConvUnread] = useState<Record<string, number>>({});
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [chatProyectos, setChatProyectos] = useState<Record<string, { contenido: string; fecha: string; autor_id: string; count: number }>>({});
  const [openNewChat, setOpenNewChat] = useState(false);
  const [openNewGroup, setOpenNewGroup] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    const [{ data: misMiembros }, { data: perfilesData }, { data: misProyectos }] = await Promise.all([
      supabase.from('miembros_conversacion' as never).select('*').eq('usuario_id', user.id),
      supabase.from('perfiles').select('*'),
      supabase.from('miembros_proyecto').select('proyecto_id, proyectos(*)').eq('usuario_id', user.id),
    ]);

    const convIds = ((misMiembros as MiembroConv[] | null) ?? []).map(m => m.conversacion_id);
    setMiembros((misMiembros as MiembroConv[] | null) ?? []);
    setPerfiles((perfilesData as Perfil[] | null) ?? []);

    const proyectosList: Proyecto[] = ((misProyectos as { proyectos: Proyecto }[] | null) ?? [])
      .map((m) => m.proyectos)
      .filter(Boolean);
    setProyectos(proyectosList);

    if (convIds.length > 0) {
      const [{ data: convsData }, { data: allMembers }] = await Promise.all([
        supabase.from('conversaciones' as never).select('*').in('id', convIds),
        supabase.from('miembros_conversacion' as never).select('*').in('conversacion_id', convIds),
      ]);
      setConvs((convsData as Conversacion[] | null) ?? []);
      setMiembros((allMembers as MiembroConv[] | null) ?? []);

      // Último mensaje por conversación
      const { data: msgs } = await supabase
        .from('mensajes_conversacion' as never)
        .select('conversacion_id, autor_id, contenido, fecha')
        .in('conversacion_id', convIds)
        .order('fecha', { ascending: false })
        .limit(500);
      const ultimosMap: Record<string, UltimoMensaje> = {};
      const unreadMap: Record<string, number> = {};
      const membersArr = (allMembers as MiembroConv[] | null) ?? [];
      const sinceByConv: Record<string, string> = {};
      membersArr.forEach((m) => {
        if (m.usuario_id === user.id) sinceByConv[m.conversacion_id] = m.fecha_ultima_lectura ?? '1970-01-01';
      });
      ((msgs as UltimoMensaje[] | null) ?? []).forEach((m) => {
        if (!ultimosMap[m.conversacion_id]) ultimosMap[m.conversacion_id] = m;
        const since = sinceByConv[m.conversacion_id] ?? '1970-01-01';
        if (m.autor_id !== user.id && new Date(m.fecha) > new Date(since)) {
          unreadMap[m.conversacion_id] = (unreadMap[m.conversacion_id] ?? 0) + 1;
        }
      });
      setUltimos(ultimosMap);
      setConvUnread(unreadMap);
    } else {
      setConvs([]);
      setUltimos({});
      setConvUnread({});
    }

    // Chat de proyectos: último mensaje + no leídos (por localStorage)
    if (proyectosList.length > 0) {
      const ids = proyectosList.map(p => p.id);
      const { data: chatMsgs } = await supabase
        .from('chat_mensajes' as never)
        .select('proyecto_id, autor_id, contenido, fecha')
        .in('proyecto_id', ids)
        .order('fecha', { ascending: false })
        .limit(500);
      const mapa: Record<string, { contenido: string; fecha: string; autor_id: string; count: number }> = {};
      const arr = (chatMsgs as { proyecto_id: string; autor_id: string; contenido: string; fecha: string }[] | null) ?? [];
      arr.forEach((m) => {
        const since = getLastSeen(m.proyecto_id, user.id);
        const isUnread = m.autor_id !== user.id && new Date(m.fecha) > new Date(since);
        if (!mapa[m.proyecto_id]) {
          mapa[m.proyecto_id] = { contenido: m.contenido, fecha: m.fecha, autor_id: m.autor_id, count: 0 };
        }
        if (isUnread) mapa[m.proyecto_id].count++;
      });
      setChatProyectos(mapa);
    } else {
      setChatProyectos({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const ch = supabase
      .channel('messages-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_conversacion' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'miembros_conversacion', filter: `usuario_id=eq.${user.id}` }, () => fetchAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, () => fetchAll())
      .subscribe();
    const onSeen = () => fetchAll();
    window.addEventListener('chat-seen', onSeen);
    return () => { supabase.removeChannel(ch); window.removeEventListener('chat-seen', onSeen); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const items = useMemo<Item[]>(() => {
    if (!user) return [];
    const result: Item[] = [];

    convs.forEach((c) => {
      const ultima = ultimos[c.id];
      const fecha = ultima?.fecha ?? c.fecha_ultimo_mensaje;
      const noLeidos = convUnread[c.id] ?? 0;

      if (c.tipo === 'directo') {
        const otroMiembro = miembros.find(m => m.conversacion_id === c.id && m.usuario_id !== user.id);
        const otroPerfil = otroMiembro ? perfiles.find(p => p.user_id === otroMiembro.usuario_id) : null;
        const titulo = otroPerfil?.nombre ?? 'Usuario';
        const preview = ultima
          ? (ultima.autor_id === user.id ? `Tú: ${ultima.contenido}` : ultima.contenido)
          : 'Sin mensajes aún';
        result.push({
          kind: 'conv', id: c.id, tipo: 'directo', titulo,
          subtitulo: preview, fecha, noLeidos,
          avatarPerfil: otroPerfil ?? null,
          navTo: `/mensajes/${c.id}`,
        });
      } else {
        const otherMembersCount = miembros.filter(m => m.conversacion_id === c.id).length;
        const autorPerfil = ultima ? perfiles.find(p => p.user_id === ultima.autor_id) : null;
        const preview = ultima
          ? `${ultima.autor_id === user.id ? 'Tú' : (autorPerfil?.nombre?.split(' ')[0] ?? 'Alguien')}: ${ultima.contenido}`
          : `${otherMembersCount} miembros`;
        result.push({
          kind: 'conv', id: c.id, tipo: 'grupo', titulo: c.nombre ?? 'Grupo',
          subtitulo: preview, fecha, noLeidos,
          colorGrupo: 'hsl(var(--primary))',
          navTo: `/mensajes/${c.id}`,
        });
      }
    });

    proyectos.forEach((p) => {
      const last = chatProyectos[p.id];
      const fecha = last?.fecha ?? '1970-01-01';
      const autorPerfil = last ? perfiles.find(pr => pr.user_id === last.autor_id) : null;
      const preview = last
        ? `${last.autor_id === user.id ? 'Tú' : (autorPerfil?.nombre?.split(' ')[0] ?? 'Alguien')}: ${last.contenido}`
        : 'Sin mensajes en el chat del proyecto';
      result.push({
        kind: 'proyecto', id: p.id, titulo: p.nombre,
        subtitulo: preview, fecha, noLeidos: last?.count ?? 0,
        color: p.color, navTo: `/proyecto/${p.id}?tab=connect`,
      });
    });

    return result.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [convs, miembros, ultimos, convUnread, perfiles, proyectos, chatProyectos, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-16 px-6">
            Aún no tienes conversaciones. Toca el botón <span className="text-primary">+</span> para empezar.
          </div>
        )}
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={`${it.kind}-${it.id}`}>
              <button
                onClick={() => navigate(it.navTo)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left ${
                  it.noLeidos > 0 ? 'bg-primary/10 border-l-2 border-primary' : ''
                }`}
              >
                {it.kind === 'conv' && it.tipo === 'directo' && it.avatarPerfil && (
                  <UserAvatar nombre={it.avatarPerfil.nombre} color={it.avatarPerfil.color_avatar} avatarUrl={it.avatarPerfil.avatar_url} size="lg" />
                )}
                {it.kind === 'conv' && it.tipo === 'grupo' && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/15 text-primary border border-primary/30">
                    <Users className="w-5 h-5" />
                  </div>
                )}
                {it.kind === 'proyecto' && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: it.color }}>
                    <Folder className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${it.noLeidos > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{it.titulo}</span>
                    <span className={`text-[10px] shrink-0 ${it.noLeidos > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{formatHora(it.fecha)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-xs truncate ${it.noLeidos > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{it.subtitulo}</span>
                    {it.noLeidos > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                        {it.noLeidos > 99 ? '99+' : it.noLeidos}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* FAB */}
      <div className="absolute right-4 bottom-20 md:bottom-6 z-40">
        {menuOpen && (
          <div className="mb-2 flex flex-col items-end gap-2">
            <button
              onClick={() => { setMenuOpen(false); setOpenNewChat(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-background border border-border shadow-lg text-sm text-foreground hover:bg-muted"
            >
              <UserIcon className="w-4 h-4 text-primary" /> Nuevo chat
            </button>
            <button
              onClick={() => { setMenuOpen(false); setOpenNewGroup(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-background border border-border shadow-lg text-sm text-foreground hover:bg-muted"
            >
              <Users className="w-4 h-4 text-primary" /> Nuevo grupo
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(0_0%_0%)_100%)] text-primary-foreground flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
          aria-label="Crear conversación"
        >
          <Plus className={`w-6 h-6 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <NewChatModal
        open={openNewChat}
        onOpenChange={setOpenNewChat}
        perfiles={perfiles.filter(p => p.user_id !== user?.id)}
        onCreated={(id) => { setOpenNewChat(false); navigate(`/mensajes/${id}`); }}
      />
      <NewGroupModal
        open={openNewGroup}
        onOpenChange={setOpenNewGroup}
        perfiles={perfiles.filter(p => p.user_id !== user?.id)}
        onCreated={(id) => { setOpenNewGroup(false); navigate(`/mensajes/${id}`); }}
      />
    </div>
  );
}