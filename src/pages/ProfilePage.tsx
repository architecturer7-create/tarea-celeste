import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import { LogOut, Mail, User } from 'lucide-react';

export default function ProfilePage() {
  const { perfil, user, signOut } = useAuth();

  if (!perfil) return null;

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-foreground mb-6">Perfil</h1>

      <div className="glass-panel rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UserAvatar nombre={perfil.nombre} color={perfil.color_avatar} size="lg" />
          <div>
            <p className="text-sm font-medium text-foreground">{perfil.nombre}</p>
            <p className="text-xs text-muted-foreground">{perfil.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 py-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="text-sm text-foreground">{perfil.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground">{perfil.email}</p>
            </div>
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
