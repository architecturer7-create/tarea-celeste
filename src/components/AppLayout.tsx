import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, User, Sparkles } from 'lucide-react';
import flowemiLogo from '@/assets/flowemi-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import AiBotFab from '@/components/AiBotFab';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { perfil, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  const proyectoIdMatch = location.pathname.match(/^\/proyecto\/([^/]+)/);
  const proyectoId = proyectoIdMatch ? proyectoIdMatch[1] : null;

  const isActive = (path: string) => location.pathname === path;

  const tabs = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/mis-tareas', icon: ClipboardList, label: 'Mis Tareas' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Safe area top spacer */}
      <div className="shrink-0 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />

      {/* Top header */}
      <header className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <img src={flowemiLogo} alt="SP Planning logo" width={28} height={28} className="w-6 h-6 md:w-7 md:h-7 rounded-lg" />
          <span className="text-xs md:text-sm font-semibold text-foreground tracking-tight">SP Planning</span>
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
          {proyectoId && (
            <button
              onClick={() => setAiOpen(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(0_0%_0%)_100%)] text-primary-foreground hover:scale-105 transition-transform shrink-0"
              title="Asistente IA"
              aria-label="Abrir asistente IA"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          {perfil && (
            <UserAvatar nombre={perfil.nombre} color={perfil.color_avatar} avatarUrl={perfil.avatar_url} size="sm" />
          )}
          <button onClick={signOut} className="hidden md:block text-xs text-muted-foreground hover:text-foreground transition-colors">
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden border-t border-border flex items-center justify-around h-12 shrink-0 bg-background">
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

      {/* Safe area bottom spacer */}
      <div className="md:hidden shrink-0 bg-background" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  );
}
