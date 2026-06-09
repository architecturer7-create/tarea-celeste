import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import type { Perfil } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  perfiles: Perfil[];
  onCreated: (conversacionId: string) => void;
}

export default function NewGroupModal({ open, onOpenChange, perfiles, onCreated }: Props) {
  const [nombre, setNombre] = useState('');
  const [q, setQ] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return perfiles.slice(0, 50);
    return perfiles.filter(p =>
      p.nombre.toLowerCase().includes(term) || p.email.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [q, perfiles]);

  const toggle = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const crear = async () => {
    if (!nombre.trim()) { toast.error('Pon un nombre al grupo'); return; }
    if (seleccionados.size === 0) { toast.error('Selecciona al menos un miembro'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('crear_grupo' as never, {
        _nombre: nombre.trim(),
        _miembros: Array.from(seleccionados),
      } as never);
      if (error || !data) {
        toast.error('No se pudo crear el grupo');
        return;
      }
      setNombre(''); setQ(''); setSeleccionados(new Set());
      onCreated(data as string);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo grupo</DialogTitle>
        </DialogHeader>
        <Input placeholder="Nombre del grupo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <Input placeholder="Buscar usuarios" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 overflow-y-auto -mx-2">
          {filtrados.map((p) => {
            const sel = seleccionados.has(p.user_id);
            return (
              <button
                key={p.user_id}
                onClick={() => toggle(p.user_id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left"
              >
                <UserAvatar nombre={p.nombre} color={p.color_avatar} avatarUrl={p.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{p.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-border'}`}>
                  {sel && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <span className="text-xs text-muted-foreground mr-auto self-center">{seleccionados.size} seleccionados</span>
          <Button onClick={crear} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}