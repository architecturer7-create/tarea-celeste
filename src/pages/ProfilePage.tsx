import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/UserAvatar';
import { LogOut, Mail, User, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { perfil, user, signOut } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!perfil) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ avatar_url: avatarUrl } as any)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Foto actualizada');
      window.location.reload();
    } catch (err: any) {
      toast.error('Error al subir la foto');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-foreground mb-6">Perfil</h1>

      <div className="glass-panel rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar nombre={perfil.nombre} color={perfil.color_avatar} avatarUrl={perfil.avatar_url} size="lg" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {uploading ? (
                <div className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-3 h-3" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
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
