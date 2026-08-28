import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Eraser } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../lib/supabase';

type ChalkPoint = {
  x: number;
  y: number;
};

type ChalkStroke = {
  id: string;
  points: ChalkPoint[];
  color: string;
  width: number;
  created_at?: string;
};

type BoardChalkLayerProps = {
  boardRef: RefObject<HTMLDivElement | null>;
  isAdmin: boolean;
  onDrawingModeChange?: (enabled: boolean) => void;
};

const CHALK_COLOR = '#f7f1d0';
const CHALK_WIDTH = 3.4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function drawChalkStroke(
  context: CanvasRenderingContext2D,
  stroke: Pick<ChalkStroke, 'points' | 'color' | 'width'>,
  width: number,
  height: number,
) {
  if (stroke.points.length === 0) return;

  const points = stroke.points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = stroke.color;

  if (points.length === 1) {
    context.globalAlpha = 0.78;
    context.fillStyle = stroke.color;
    context.beginPath();
    context.arc(points[0].x, points[0].y, stroke.width * 0.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  const passes = [
    { offset: 0, alpha: 0.72, lineWidth: stroke.width },
    { offset: -0.7, alpha: 0.22, lineWidth: Math.max(0.9, stroke.width * 0.52) },
    { offset: 0.9, alpha: 0.18, lineWidth: Math.max(0.8, stroke.width * 0.42) },
  ];

  for (const pass of passes) {
    context.globalAlpha = pass.alpha;
    context.lineWidth = pass.lineWidth;
    context.beginPath();

    points.forEach((point, index) => {
      const grain = Math.sin((point.x + point.y + index * 7.13) * 0.085) * pass.offset;
      const x = point.x + grain;
      const y = point.y - grain * 0.65;

      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });

    context.stroke();
  }

  context.globalAlpha = 0.12;
  context.lineWidth = Math.max(0.7, stroke.width * 0.3);
  context.setLineDash([1.2, 2.4]);
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
  context.restore();
}

export function BoardChalkLayer({ boardRef, isAdmin, onDrawingModeChange }: BoardChalkLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointsRef = useRef<ChalkPoint[]>([]);
  const strokesRef = useRef<ChalkStroke[]>([]);
  const [strokes, setStrokes] = useState<ChalkStroke[]>([]);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [ready, setReady] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    onDrawingModeChange?.(drawingEnabled);
  }, [drawingEnabled, onDrawingModeChange]);

  useEffect(() => {
    let channel: any = null;
    let cancelled = false;

    async function setup() {
      const { data, error } = await supabase
        .from('flow_board_strokes')
        .select('id, points, color, width, created_at')
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        setReady(false);
        return;
      }

      setReady(true);
      setStrokes((data || []) as ChalkStroke[]);

      channel = supabase
        .channel('flow-board-chalk-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'flow_board_strokes' },
          (payload) => {
            const next = payload.new as ChalkStroke;
            setStrokes((current) => {
              if (current.some((stroke) => stroke.id === next.id)) return current;
              return [...current, next];
            });
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'flow_board_strokes' },
          (payload) => {
            const removed = payload.old as Pick<ChalkStroke, 'id'>;
            setStrokes((current) => current.filter((stroke) => stroke.id !== removed.id));
          },
        )
        .subscribe();
    }

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const resizeAndPaint = () => {
      const rect = board.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const context = canvas.getContext('2d');
      if (!context) return;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      for (const stroke of strokesRef.current) {
        drawChalkStroke(context, stroke, rect.width, rect.height);
      }
    };

    resizeAndPaint();
    const observer = new ResizeObserver(resizeAndPaint);
    observer.observe(board);

    return () => observer.disconnect();
  }, [boardRef, strokes]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function repaintWithDraft(points: ChalkPoint[]) {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = board.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokesRef.current) {
      drawChalkStroke(context, stroke, rect.width, rect.height);
    }

    drawChalkStroke(
      context,
      { points, color: CHALK_COLOR, width: CHALK_WIDTH },
      rect.width,
      rect.height,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isAdmin || !drawingEnabled || !ready) return;

    const point = pointFromEvent(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    activePointsRef.current = [point];
    setDrawing(true);
    repaintWithDraft(activePointsRef.current);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing || !drawingEnabled) return;

    const point = pointFromEvent(event);
    if (!point) return;

    const points = activePointsRef.current;
    const previous = points[points.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0017) return;

    activePointsRef.current = [...points, point];
    repaintWithDraft(activePointsRef.current);
  }

  async function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // O navegador pode liberar o pointer capture automaticamente.
    }

    setDrawing(false);
    const points = activePointsRef.current;
    activePointsRef.current = [];

    if (points.length === 0) return;

    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('flow_board_strokes')
      .insert({
        points,
        color: CHALK_COLOR,
        width: CHALK_WIDTH,
        created_by: authData.user?.id || null,
      })
      .select('id, points, color, width, created_at')
      .single();

    if (error) {
      repaintWithDraft([]);
      toast.error('Não foi possível salvar o risco de giz.');
      return;
    }

    if (data) {
      const saved = data as ChalkStroke;
      setStrokes((current) => (current.some((stroke) => stroke.id === saved.id) ? current : [...current, saved]));
    }
  }

  async function clearChalk() {
    if (!isAdmin || clearing) return;
    if (!window.confirm('Apagar todos os riscos de giz da lousa?')) return;

    setClearing(true);
    const { error } = await supabase
      .from('flow_board_strokes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    setClearing(false);

    if (error) {
      toast.error('Não foi possível apagar os riscos da lousa.');
      return;
    }

    setStrokes([]);
    toast.success('Lousa limpa.');
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`flow-chalk-canvas ${drawingEnabled ? 'is-active' : ''}`}
        aria-label="Área de desenho com giz"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => void finishStroke(event)}
        onPointerCancel={(event) => void finishStroke(event)}
      />

      {isAdmin && (
        <div className="flow-chalk-corner" aria-label="Ferramentas da lousa">
          {drawingEnabled && (
            <button
              type="button"
              className="flow-board-eraser"
              onClick={() => void clearChalk()}
              disabled={!ready || clearing}
              title="Apagar todos os riscos de giz"
            >
              <Eraser className="h-4 w-4" />
              <span>{clearing ? 'Limpando...' : 'Apagar giz'}</span>
            </button>
          )}

          <button
            type="button"
            className={`flow-real-chalk ${drawingEnabled ? 'is-active' : ''}`}
            onClick={() => setDrawingEnabled((current) => !current)}
            disabled={!ready}
            aria-pressed={drawingEnabled}
            title={ready ? (drawingEnabled ? 'Guardar o giz' : 'Pegar o giz e desenhar') : 'Execute a migration do giz no Supabase'}
          >
            <span className="flow-chalk-stick" aria-hidden="true" />
            <span className="sr-only">{drawingEnabled ? 'Guardar giz' : 'Usar giz'}</span>
          </button>
        </div>
      )}
    </>
  );
}
