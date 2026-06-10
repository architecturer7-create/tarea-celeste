import { useRef, useState } from 'react';
import { Paperclip, Monitor, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  /** Called when the user picks any file (after optional annotation for images). */
  onFile: (file: File) => void;
  /** Called with an image File to open the annotator. */
  onAnnotate: (file: File) => void;
  /** When true, file picker only accepts images. */
  imageOnly?: boolean;
  disabled?: boolean;
}

export default function ChatAttachControls({ onFile, onAnnotate, imageOnly, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const captureScreen = async () => {
    setOpen(false);
    const md = (navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream> });
    if (!md.getDisplayMedia) {
      toast.error('Captura de pantalla no soportada en este dispositivo. Adjunta una imagen.');
      imgRef.current?.click();
      return;
    }
    try {
      const stream = await md.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      // Wait one frame so the source is ready
      await new Promise(r => setTimeout(r, 200));
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      track.stop();
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png')!);
      const file = new File([blob], `captura-${Date.now()}.png`, { type: 'image/png' });
      onAnnotate(file);
    } catch (err) {
      // user cancelled or denied
      if ((err as Error).name !== 'NotAllowedError') {
        toast.error('No se pudo capturar la pantalla');
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={imageOnly ? 'image/*' : undefined}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50"
        title="Adjuntar"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-40 min-w-[200px] rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            <MenuItem icon={<Paperclip className="w-4 h-4" />} label={imageOnly ? 'Imagen' : 'Archivo'} onClick={() => { setOpen(false); fileRef.current?.click(); }} />
            <MenuItem icon={<ImageIcon className="w-4 h-4" />} label="Imagen" onClick={() => { setOpen(false); imgRef.current?.click(); }} />
            <MenuItem icon={<Monitor className="w-4 h-4" />} label="Capturar pantalla" onClick={captureScreen} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left">
      <span className="text-muted-foreground">{icon}</span>{label}
    </button>
  );
}