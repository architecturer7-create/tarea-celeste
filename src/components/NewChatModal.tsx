import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Perfil } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  perfiles: Perfil[];
  onCreated: (conversacionId: string) => void;
}

export default function NewChatModal({ open, onOpenChange, perfiles, onCreated }: Props) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return perfiles.slice(0, 30);
    return perfiles.filter(p =>
      p.nombre.toLowerCase().includes(term) || p.email.toLowerCase().includes(term)
    ).slice(0, 30);
  }, [q, perfiles]);

  const elegir = async (p: Perfil) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('crear_chat_directo' as never, { _otro_usuario_id: p.user_id } as never);
      if (error || !data) {
        toast.error('No se pudo crear el chat');
        return;
      }
      onCreated(data as string);
      setQ('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo chat</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar por nombre o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto -mx-2">
          {filtrados.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">Sin resultados</div>
          )}
          {filtrados.map((p) => (
            <button
              key={p.user_id}
              onClick={() => elegir(p)}
              disabled={busy}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left disabled:opacity-50"
            >
              <UserAvatar nombre={p.nombre} color={p.color_avatar} avatarUrl={p.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{p.nombre}</div>
                <div className="text-xs text-muted-foreground truncate">{p.email}</div>
              </div>
              {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}