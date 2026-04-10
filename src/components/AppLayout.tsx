import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, Home, ClipboardList, User, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { perfil, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const tabs = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/mis-tareas', icon: ClipboardList, label: 'Mis Tareas' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0 safe-top">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-primary flex items-center justify-center">
            <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-foreground" />
          </div>
          <span className="text-xs md:text-sm font-semibold text-foreground tracking-tight">TaskFlow</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive(tab.path) ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {perfil && (
            <UserAvatar nombre={perfil.nombre} color={perfil.color_avatar} size="sm" />
          )}
          <button onClick={signOut} className="hidden md:block text-xs text-muted-foreground hover:text-foreground transition-colors">
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden border-t border-border flex items-center justify-around h-12 shrink-0 safe-bottom bg-background">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 py-0.5 px-3 transition-colors ${
                isActive(tab.path) ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
