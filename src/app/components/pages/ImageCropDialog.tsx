import { useEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, ZoomIn } from 'lucide-react';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type CropAspect = {
  label: string;
  value: number;
};

type ImageCropDialogProps = {
  file: File | null;
  open: boolean;
  title?: string;
  description?: string;
  initialAspect?: number;
  aspectOptions?: CropAspect[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => Promise<void> | void;
};

const defaultAspects: CropAspect[] = [
  { label: 'Quadrado', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ImageCropDialog({
  file,
  open,
  title = 'Ajustar imagem',
  description = 'Arraste a imagem para escolher exatamente a área que será usada.',
  initialAspect = 4 / 3,
  aspectOptions = defaultAspects,
  onOpenChange,
  onConfirm,
}: ImageCropDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [objectUrl, setObjectUrl] = useState('');
  const [aspect, setAspect] = useState(initialAspect);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl('');
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    setAspect(initialAspect);
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    return () => URL.revokeObjectURL(nextUrl);
  }, [file, initialAspect]);

  function measureBaseSize() {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image || !image.naturalWidth || !image.naturalHeight) return;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (!viewportWidth || !viewportHeight) return;

    const imageAspect = image.naturalWidth / image.naturalHeight;
    const viewportAspect = viewportWidth / viewportHeight;

    if (imageAspect > viewportAspect) {
      const height = viewportHeight;
      setBaseSize({ width: height * imageAspect, height });
    } else {
      const width = viewportWidth;
      setBaseSize({ width, height: width / imageAspect });
    }
  }

  useEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (!('ResizeObserver' in window)) {
      window.addEventListener('resize', measureBaseSize);
      return () => window.removeEventListener('resize', measureBaseSize);
    }

    const observer = new ResizeObserver(() => measureBaseSize());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [open, aspect, objectUrl]);

  function clampOffset(candidate: { x: number; y: number }, nextZoom = zoom) {
    const viewport = viewportRef.current;
    if (!viewport) return candidate;

    const maxX = Math.max(0, (baseSize.width * nextZoom - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (baseSize.height * nextZoom - viewport.clientHeight) / 2);

    return {
      x: clamp(candidate.x, -maxX, maxX),
      y: clamp(candidate.y, -maxY, maxY),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!baseSize.width || !baseSize.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const candidate = {
      x: dragRef.current.offsetX + event.clientX - dragRef.current.pointerX,
      y: dragRef.current.offsetY + event.clientY - dragRef.current.pointerY,
    };
    setOffset(clampOffset(candidate));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Browser may release pointer capture itself.
    }
    dragRef.current = null;
    setDragging(false);
  }

  function changeAspect(nextAspect: number) {
    setAspect(nextAspect);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    requestAnimationFrame(() => measureBaseSize());
  }

  function changeZoom(nextZoom: number) {
    setZoom(nextZoom);
    setOffset((current) => clampOffset(current, nextZoom));
  }

  function resetCrop() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 20 : 8;
    let next = offset;

    if (event.key === 'ArrowLeft') next = { ...offset, x: offset.x - step };
    else if (event.key === 'ArrowRight') next = { ...offset, x: offset.x + step };
    else if (event.key === 'ArrowUp') next = { ...offset, y: offset.y - step };
    else if (event.key === 'ArrowDown') next = { ...offset, y: offset.y + step };
    else return;

    event.preventDefault();
    setOffset(clampOffset(next));
  }

  async function confirmCrop() {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!file || !viewport || !image || !image.naturalWidth || !image.naturalHeight) return;

    setSaving(true);
    try {
      const viewportRect = viewport.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();

      const scaleX = image.naturalWidth / imageRect.width;
      const scaleY = image.naturalHeight / imageRect.height;

      const sourceX = clamp((viewportRect.left - imageRect.left) * scaleX, 0, image.naturalWidth);
      const sourceY = clamp((viewportRect.top - imageRect.top) * scaleY, 0, image.naturalHeight);
      const sourceWidth = clamp(viewportRect.width * scaleX, 1, image.naturalWidth - sourceX);
      const sourceHeight = clamp(viewportRect.height * scaleY, 1, image.naturalHeight - sourceY);

      const targetWidth = Math.max(1, Math.min(1400, Math.round(sourceWidth)));
      const targetHeight = Math.max(1, Math.round(targetWidth / aspect));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('O navegador não conseguiu preparar o recorte.');

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error('Não foi possível gerar a imagem recortada.')),
          'image/webp',
          0.9,
        );
      });

      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const croppedFile = new File([blob], `${cleanName || 'imagem'}-recortada.webp`, { type: 'image/webp' });
      await onConfirm(croppedFile);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="flow-dialog flow-crop-dialog max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            <DialogTitle className="text-xl font-black">{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flow-crop-shell">
          <div
            ref={viewportRef}
            className={`flow-crop-viewport ${dragging ? 'is-dragging' : ''}`}
            style={{ aspectRatio: String(aspect) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Área de recorte. Arraste a imagem ou use as setas do teclado para reposicionar."
          >
            {objectUrl && (
              <img
                ref={imageRef}
                src={objectUrl}
                alt="Pré-visualização para recorte"
                draggable={false}
                onLoad={measureBaseSize}
                style={{
                  width: `${baseSize.width}px`,
                  height: `${baseSize.height}px`,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
            )}
            <div className="flow-crop-grid" aria-hidden="true" />
            <div className="flow-crop-hint">Arraste a imagem</div>
          </div>

          <div className="flow-crop-toolbar">
            <div className="flow-crop-aspects" aria-label="Formato do recorte">
              {aspectOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={Math.abs(aspect - option.value) < 0.01 ? 'is-active' : ''}
                  onClick={() => changeAspect(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="flow-crop-zoom">
              <ZoomIn className="h-4 w-4" />
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => changeZoom(Number(event.target.value))}
              />
            </label>

            <button type="button" className="flow-crop-reset" onClick={resetCrop}>
              <RotateCcw className="h-4 w-4" />
              Reposicionar
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flow-secondary-button">
            Cancelar
          </Button>
          <Button onClick={() => void confirmCrop()} disabled={saving || !file} className="flow-primary-button">
            <Crop className="h-4 w-4" />
            {saving ? 'Aplicando...' : 'Usar este recorte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
