import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Edit3, Grip, Pin, Trash2 } from 'lucide-react';

type BoardNoteProps = {
  id: string;
  title: string;
  content: string;
  emoji?: string | null;
  imageUrl?: string | null;
  headerIconUrl?: string | null;
  paperColor?: string | null;
  textColor?: string | null;
  noteSize?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  rotation?: number | null;
  zIndex?: number | null;
  pinned?: boolean;
  draft?: boolean;
  isAdmin: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (id: string, x: number, y: number) => void;
};

const presetPaperColors: Record<string, string> = {
  ice: '#fbfaf3',
  sky: '#edf4f6',
  mint: '#eef5eb',
  peach: '#faf0e7',
  lemon: '#faf6d9',
  lilac: '#f3f0f8',
  rose: '#f8eeee',
  sand: '#f1e7d4',
  blue: '#dfeaf0',
  cobalt: '#244842',
  midnight: '#202a28',
};

// Largura relativa ao próprio quadro (container query), não à tela — assim a
// posição em % sempre corresponde ao mesmo lugar visual, independente do
// tamanho do monitor/janela de quem está olhando.
const sizeDimensions: Record<string, { width: string; minHeight: string }> = {
  sm: { width: 'clamp(150px, 16cqw, 190px)', minHeight: '130px' },
  md: { width: 'clamp(180px, 19cqw, 230px)', minHeight: '155px' },
  lg: { width: 'clamp(210px, 23cqw, 280px)', minHeight: '185px' },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null;
}

function resolvePaperColor(value?: string | null) {
  const custom = normalizeHex(value);
  if (custom) return custom;
  return presetPaperColors[String(value || 'ice')] || presetPaperColors.ice;
}

function resolveTextColor(_paperColor: string, requested?: string | null) {
  // A cor escolhida pelo usuário é sempre respeitada — sem nenhuma troca
  // automática por trás. Só cai no padrão se nada tiver sido definido.
  return normalizeHex(requested) || '#101719';
}

export function BoardNote({
  id,
  title,
  content,
  emoji,
  imageUrl,
  headerIconUrl,
  paperColor = 'ice',
  textColor = '#16324b',
  noteSize = 'md',
  positionX = 8,
  positionY = 8,
  rotation = 0,
  zIndex = 1,
  pinned = false,
  draft = false,
  isAdmin,
  boardRef,
  onEdit,
  onDelete,
  onMove,
}: BoardNoteProps) {
  const [localPosition, setLocalPosition] = useState({
    x: Number(positionX ?? 8),
    y: Number(positionY ?? 8),
  });
  const dragStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (dragging) return;
    setLocalPosition({ x: Number(positionX ?? 8), y: Number(positionY ?? 8) });
  }, [positionX, positionY, dragging]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isAdmin || !boardRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: localPosition.x,
      y: localPosition.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragStart.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - dragStart.current.pointerX) / rect.width) * 100;
    const deltaY = ((event.clientY - dragStart.current.pointerY) / rect.height) * 100;

    setLocalPosition({
      x: clamp(dragStart.current.x + deltaX, 1, 82),
      y: clamp(dragStart.current.y + deltaY, 1, 76),
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Browser may release it automatically.
    }

    setDragging(false);
    dragStart.current = null;
    onMove(id, localPosition.x, localPosition.y);
  }

  const resolvedPaperColor = resolvePaperColor(paperColor);
  const resolvedTextColor = resolveTextColor(resolvedPaperColor, textColor);
  const dimensions = sizeDimensions[noteSize || 'md'] || sizeDimensions.md;

  return (
    <article
      className={`flow-board-note group absolute ${dragging ? 'is-dragging' : ''}`}
      data-note-size={noteSize || 'md'}
      style={{
        left: `${localPosition.x}%`,
        top: `${localPosition.y}%`,
        zIndex: 20 + Number(zIndex ?? 1),
        transform: `rotate(${Number(rotation ?? 0)}deg)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="flow-board-note-paper"
        style={{
          '--paper-base': resolvedPaperColor,
          '--flow-note-text': resolvedTextColor,
          width: dimensions.width,
          minHeight: dimensions.minHeight,
        } as CSSProperties}
      >
        <span className="flow-board-pin" aria-hidden="true"><span /></span>
        <span className="flow-note-holes" aria-hidden="true" />

        {isAdmin && (
          <div className="flow-note-admin-tools">
            <span className="flow-note-drag-hint" title="Arraste o aviso">
              <Grip className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="flow-note-action"
              title="Editar aviso"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="flow-note-action is-danger"
              title="Excluir aviso"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flow-note-topline">
          {headerIconUrl ? (
            <span className="flow-note-platform-badge">
              <img src={headerIconUrl} alt="Ícone da plataforma" loading="lazy" />
            </span>
          ) : (
            <span className="flow-note-platform-badge is-empty" />
          )}

          <div className="flow-note-header-flags" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="flow-note-copy">
          <div className="flow-note-heading">
            {emoji && <span className="flow-note-emoji">{emoji}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flow-note-title">{title}</h3>
                {pinned && <Pin className="h-3.5 w-3.5 opacity-55" />}
                {draft && <span className="flow-note-draft">rascunho</span>}
              </div>
            </div>
          </div>

          {imageUrl && (
            <div className="flow-note-image">
              <img
                src={imageUrl}
                alt="Imagem do aviso"
                className="flow-note-image-media"
                loading="lazy"
              />
            </div>
          )}

          <p className="flow-note-content">{content}</p>
        </div>
      </div>
    </article>
  );
}
