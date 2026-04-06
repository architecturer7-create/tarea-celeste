interface UserAvatarProps {
  nombre: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function UserAvatar({ nombre, color, size = 'md', className = '' }: UserAvatarProps) {
  const initial = nombre?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-primary-foreground shrink-0 ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
      title={nombre}
    >
      {initial}
    </div>
  );
}
