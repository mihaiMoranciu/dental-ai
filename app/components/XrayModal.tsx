'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Prediction } from '@/app/types/xray';
import DentalChart from '@/app/components/DentalChart';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Props {
  imageSrc: string;
  dentalProblems: Prediction[];
  teethSeg: Prediction[];
  imageWidth: number;
  imageHeight: number;
  onClose: () => void;
}

const PROBLEM_COLORS: Record<string, [number, number, number]> = {
  'Prosthesis':  [200, 90, 50],
  'Root Canal':  [120, 90, 40],
  'caries':      [0,   90, 50],
  'impaction':   [45, 100, 50],
  'restoration': [270, 90, 50],
  'root stump':  [30,  90, 40],
};

function getColor(cls: string): [number, number, number] {
  return PROBLEM_COLORS[cls] ?? [200, 70, 50];
}

function isInPolygon(x: number, y: number, pts: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function isInRect(x: number, y: number, p: Prediction) {
  return x >= p.x - p.width / 2 && x <= p.x + p.width / 2 &&
         y >= p.y - p.height / 2 && y <= p.y + p.height / 2;
}

export default function XrayModal({ imageSrc, dentalProblems, teethSeg, imageWidth, imageHeight, onClose }: Props) {
  const [showProblems, setShowProblems] = useState(true);
  const [showTeeth, setShowTeeth] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (showTeeth) {
      teethSeg.forEach(pred => {
        if (!pred.points?.length) return;
        const hovered = pred.detection_id === hoveredIdRef.current;
        const hue = (pred.class_id * 37) % 360;
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${hovered ? 0.55 : 0.3})`;
        ctx.strokeStyle = `hsl(${hue}, 90%, ${hovered ? 35 : 40}%)`;
        ctx.lineWidth = hovered ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(pred.points[0].x, pred.points[0].y);
        for (let i = 1; i < pred.points.length; i++) ctx.lineTo(pred.points[i].x, pred.points[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (pred.points && pred.points.length > 0) {
          const cx = pred.points.reduce((s, p) => s + p.x, 0) / pred.points.length;
          const cy = pred.points.reduce((s, p) => s + p.y, 0) / pred.points.length;
          const fontSize = Math.max(12, Math.min(pred.width, pred.height) * 0.22);
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 4;
          ctx.fillStyle = 'white';
          ctx.fillText(pred.class, cx, cy);
          ctx.shadowBlur = 0;
        }
      });
    }

    if (showProblems) {
      dentalProblems.forEach(pred => {
        const hovered = pred.detection_id === hoveredIdRef.current;
        const [h, s, l] = getColor(pred.class);
        const x = pred.x - pred.width / 2;
        const y = pred.y - pred.height / 2;

        ctx.strokeStyle = `hsl(${h}, ${s}%, ${hovered ? l - 10 : l}%)`;
        ctx.lineWidth = hovered ? 4 : 3;
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${hovered ? 0.4 : 0.22})`;
        ctx.beginPath();
        ctx.rect(x, y, pred.width, pred.height);
        ctx.fill();
        ctx.stroke();

        const labelH = 20;
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y - labelH, pred.width, labelH);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pred.class}  ${Math.round(pred.confidence * 100)}%`, x + 4, y - labelH / 2);
      });
    }
  }, [dentalProblems, teethSeg, showProblems, showTeeth]);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => { imgRef.current = img; drawCanvas(); };
  }, [imageSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (imgRef.current) drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
    if (imgRef.current) drawCanvas();
  }, [hoveredId, drawCanvas]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !imageWidth) return;
      const w = container.clientWidth;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w / (imageWidth / imageHeight)}px`;
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    let found: string | null = null;
    if (showTeeth) {
      for (const p of teethSeg) {
        if (p.points && isInPolygon(x, y, p.points)) { found = p.detection_id; break; }
      }
    }
    if (!found && showProblems) {
      for (const p of dentalProblems) {
        if (isInRect(x, y, p)) { found = p.detection_id; break; }
      }
    }
    if (found !== hoveredId) setHoveredId(found);
  }

  const uniqueTeeth = new Set(teethSeg.map(p => p.class)).size;
  const allClasses = [...new Set(dentalProblems.map(p => p.class))];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'hsl(220 30% 2% / 0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 0 0 1px hsl(187 80% 46% / 0.08), 0 32px 64px hsl(220 30% 2% / 0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Teal top stripe */}
        <div style={{ height: '2px', background: 'linear-gradient(to right, transparent, hsl(187, 80%, 46%), transparent)', flexShrink: 0 }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0">
          <div>
            <h2 className="text-foreground font-semibold text-sm">Analiza Radiografiei</h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              <span style={{ color: 'hsl(187, 70%, 60%)' }}>{dentalProblems.length}</span> probleme
              &nbsp;·&nbsp;
              <span style={{ color: 'hsl(187, 60%, 55%)' }}>{uniqueTeeth}</span> dinți unici
              &nbsp;·&nbsp; hover pentru detalii
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Controls */}
        <div className="px-5 py-2.5 flex flex-wrap gap-5 items-center shrink-0">
          <div className="flex items-center gap-2">
            <Checkbox
              id="toggle-problems"
              checked={showProblems}
              onCheckedChange={v => setShowProblems(!!v)}
            />
            <Label htmlFor="toggle-problems" className="cursor-pointer font-normal text-sm text-foreground/80">
              Probleme
              <span
                className="ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: 'hsl(187 80% 46% / 0.1)', color: 'hsl(187, 80%, 60%)', border: '1px solid hsl(187 80% 46% / 0.2)' }}
              >
                {dentalProblems.length}
              </span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="toggle-teeth"
              checked={showTeeth}
              onCheckedChange={v => setShowTeeth(!!v)}
            />
            <Label htmlFor="toggle-teeth" className="cursor-pointer font-normal text-sm text-foreground/80">
              Dinți
              <span
                className="ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: 'hsl(187 80% 46% / 0.1)', color: 'hsl(187, 80%, 60%)', border: '1px solid hsl(187 80% 46% / 0.2)' }}
              >
                {uniqueTeeth} unici
              </span>
            </Label>
          </div>
        </div>

        <Separator />

        {/* Canvas + dental chart */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <div ref={containerRef} className="w-full">
            <canvas
              ref={canvasRef}
              width={imageWidth}
              height={imageHeight}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredId(null)}
              style={{ width: '100%', height: 'auto', display: 'block', cursor: hoveredId ? 'pointer' : 'default', borderRadius: '8px' }}
            />
          </div>

          {showTeeth && teethSeg.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <DentalChart teethSeg={teethSeg} dentalProblems={dentalProblems} />
            </div>
          )}
        </div>

        {/* Legend */}
        {allClasses.length > 0 && (
          <>
            <Separator />
            <div className="px-5 py-3 shrink-0 flex flex-wrap gap-x-4 gap-y-1.5">
              {allClasses.map(cls => {
                const [h, s, l] = getColor(cls);
                return (
                  <div key={cls} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: `hsl(${h},${s}%,${l}%)` }} />
                    <span className="text-muted-foreground text-xs">{cls}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
