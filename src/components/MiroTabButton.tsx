import { useEffect, useState } from 'react';
import { ChevronDown, Plus, SquareDashedKanban, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface BoardRow { id: string; nombre: string; }

interface Props {
  proyectoId: string;
  isOwner: boolean;
  isActive: boolean;
  activeBoardId: string | null;
  onOpenBoard: (boardId: string | null) => void;
  onCreate: () => void;
}

export default function MiroTabButton({ proyectoId, isOwner, isActive, activeBoardId, onOpenBoard, onCreate }: Props) {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [open, setOpen] = useState(false);

  const fetchBoards = async () => {
    const { data } = await supabase
      .from('proyecto_miro')
      .select('id, nombre')
      .eq('proyecto_id', proyectoId)
      .order('fecha_actualizacion', { ascending: true });
    setBoards((data as BoardRow[] | null) ?? []);
  };

  useEffect(() => { fetchBoards(); }, [proyectoId]);

  useEffect(() => {
    const ch = supabase
      .channel(`miro-tab-${proyectoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyecto_miro', filter: `proyecto_id=eq.${proyectoId}` }, () => fetchBoards())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId]);

  const baseClass = `flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] md:text-xs transition-colors ${
    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
  }`;

  // 0 or 1 boards → plain button
  if (boards.length < 2) {
    return (
      <button
        onClick={() => onOpenBoard(boards[0]?.id ?? null)}
        className={baseClass}
      >
        <SquareDashedKanban className="w-3.5 h-3.5" /> Miro
      </button>
    );
  }

  // 2+ → dropdown
  const activeName = boards.find(b => b.id === activeBoardId)?.nombre;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={baseClass}>
          <SquareDashedKanban className="w-3.5 h-3.5" /> Miro
          {isActive && activeName && (
            <span className="text-muted-foreground hidden md:inline">· {activeName}</span>
          )}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1 bg-popover border-border">
        <div className="max-h-64 overflow-y-auto">
          {boards.map(b => (
            <button
              key={b.id}
              onClick={() => { setOpen(false); onOpenBoard(b.id); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-foreground text-left"
            >
              <Check className={`w-3 h-3 ${isActive && b.id === activeBoardId ? 'text-primary' : 'text-transparent'}`} />
              <span className="truncate">{b.nombre}</span>
            </button>
          ))}
        </div>
        {isOwner && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => { setOpen(false); onCreate(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar tablero
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}