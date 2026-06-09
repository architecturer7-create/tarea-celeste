import { ESTADO_CONFIG, type EstadoTarea } from '@/lib/types';

interface StatusDotProps {
  estado: EstadoTarea;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  count?: number;
}

export function StatusDot({ estado, showLabel = false, size = 'sm', count }: StatusDotProps) {
  const config = ESTADO_CONFIG[estado];
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full ${dotSize}`} style={{ backgroundColor: config.color }} />
      {showLabel && <span className="text-xs text-muted-foreground">{config.label}</span>}
      {typeof count === 'number' && (
        <span className="text-[10px] text-muted-foreground/60">{count}</span>
      )}
    </span>
  );
}
