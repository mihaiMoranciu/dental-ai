'use client';
import React from 'react';
import type { Prediction } from '@/app/types/xray';

interface Props {
  teethSeg:      Prediction[];
  dentalProblems: Prediction[]; // already filtered by confidence from XrayModal
}

// FDI notation: Q1=upper-right, Q2=upper-left, Q3=lower-left, Q4=lower-right
// Rows ordered left→right on screen = patient's right→left (standard panoramic orientation)
const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

type ToothType = 'molar' | 'premolar' | 'canine' | 'incisor';

function getType(n: number): ToothType {
  const pos = n % 10; // FDI last digit = position from center (1=central, 8=third molar)
  if (pos >= 6) return 'molar';
  if (pos >= 4) return 'premolar';
  if (pos === 3) return 'canine';
  return 'incisor';
}

const SHAPES: Record<ToothType, { path: string; w: number; h: number }> = {
  incisor: {
    w: 20, h: 50,
    path: 'M 10,2 C 13,2 14,8 14,22 C 15,24 17,26 17,45 Q 17,50 10,50 Q 3,50 3,45 C 3,26 5,24 6,22 C 6,8 7,2 10,2 Z',
  },
  canine: {
    w: 18, h: 56,
    path: 'M 9,2 C 12,2 13,8 13,22 C 14,24 15,28 15,46 C 15,53 12,57 9,57 C 6,57 3,53 3,46 C 3,28 4,24 5,22 C 5,8 6,2 9,2 Z',
  },
  premolar: {
    w: 22, h: 50,
    path: 'M 11,2 C 15,2 16,8 16,22 C 17,24 19,25 20,27 Q 21,36 20,45 Q 20,50 11,50 Q 2,50 2,45 Q 1,36 2,27 C 3,25 5,24 6,22 C 6,8 7,2 11,2 Z',
  },
  molar: {
    w: 30, h: 50,
    path: 'M 9,1 C 12,0 13,5 13,18 C 14,20 18,20 19,18 C 19,5 20,0 23,1 C 26,1 27,6 27,18 C 28,20 29,22 29,43 Q 29,50 15,50 Q 1,50 1,43 C 1,22 2,20 3,18 C 3,6 5,1 9,1 Z',
  },
};

// Colors for detected teeth
const TOOTH_COLOR = {
  upper: { fill: '#2563eb', stroke: '#60a5fa' },
  lower: { fill: '#0891b2', stroke: '#22d3ee' },
  none:  { fill: '#1e293b', stroke: '#334155' },
};

// Colors per dental problem class (same palette as canvas)
const PROBLEM_COLORS: Record<string, string> = {
  'Prosthesis':  'hsl(200,90%,55%)',
  'Root Canal':  'hsl(120,85%,42%)',
  'caries':      'hsl(0,90%,58%)',
  'impaction':   'hsl(45,100%,52%)',
  'restoration': 'hsl(270,85%,62%)',
  'root stump':  'hsl(30,90%,50%)',
};
function problemColor(cls: string) {
  return PROBLEM_COLORS[cls] ?? 'hsl(200,70%,55%)';
}

// ── Mapping: dental problems → tooth numbers ────────────────────────────────
// Uses bounding-box overlap in original image coordinates.
// Falls back to nearest tooth center if no overlap found.
function mapProblemsToTeeth(
  teethSeg: Prediction[],
  dentalProblems: Prediction[],
): Map<number, { cls: string; confidence: number }[]> {
  const result = new Map<number, { cls: string; confidence: number }[]>();
  if (!teethSeg.length) return result;

  for (const prob of dentalProblems) {
    const pL = prob.x - prob.width  / 2, pR = prob.x + prob.width  / 2;
    const pT = prob.y - prob.height / 2, pB = prob.y + prob.height / 2;

    let bestNum  = -1;
    let bestArea = 0;

    for (const tooth of teethSeg) {
      const tL = tooth.x - tooth.width  / 2, tR = tooth.x + tooth.width  / 2;
      const tT = tooth.y - tooth.height / 2, tB = tooth.y + tooth.height / 2;
      const w = Math.max(0, Math.min(pR, tR) - Math.max(pL, tL));
      const h = Math.max(0, Math.min(pB, tB) - Math.max(pT, tT));
      const area = w * h;
      if (area > bestArea) { bestArea = area; bestNum = Number(tooth.class); }
    }

    // Nearest-tooth fallback
    if (bestNum === -1) {
      let minDist = Infinity;
      for (const tooth of teethSeg) {
        const d = Math.hypot(prob.x - tooth.x, prob.y - tooth.y);
        if (d < minDist) { minDist = d; bestNum = Number(tooth.class); }
      }
    }

    if (bestNum !== -1) {
      if (!result.has(bestNum)) result.set(bestNum, []);
      result.get(bestNum)!.push({ cls: prob.class, confidence: prob.confidence });
    }
  }
  return result;
}

// ── Tooth SVG shape ──────────────────────────────────────────────────────────
function ToothSVG({ n, detected, arch }: { n: number; detected: boolean; arch: 'upper' | 'lower' }) {
  const type  = getType(n);
  const shape = SHAPES[type];
  const col   = detected ? TOOTH_COLOR[arch] : TOOTH_COLOR.none;
  const flip  = arch === 'lower' ? `scale(1,-1) translate(0,-${shape.h})` : undefined;

  return (
    <svg width={shape.w} height={shape.h} viewBox={`0 0 ${shape.w} ${shape.h}`}
      className="shrink-0 block" style={{ overflow: 'visible' }}>
      <g transform={flip}>
        <path d={shape.path} fill={col.fill} stroke={col.stroke}
          strokeWidth={detected ? 1.2 : 0.8} opacity={detected ? 1 : 0.4} />
      </g>
    </svg>
  );
}

// ── Problem dots ─────────────────────────────────────────────────────────────
// One dot per unique problem class (max 4). Opacity encodes confidence:
//   confidence 20% → opacity 0.20  |  confidence 100% → opacity 1.0
function confidenceToOpacity(c: number): number {
  // linear map [0.20, 1.0] → [0.20, 1.0]
  return Math.max(0.20, Math.min(1, (c - 0.20) / 0.80 * 0.80 + 0.20));
}

function ProblemDots({ problems }: { problems: { cls: string; confidence: number }[] }) {
  if (!problems.length) return <div className="h-3" />;

  // Deduplicate: keep highest-confidence instance per class
  const byClass = new Map<string, number>();
  for (const { cls, confidence } of problems) {
    if (!byClass.has(cls) || confidence > byClass.get(cls)!) byClass.set(cls, confidence);
  }

  const entries = [...byClass.entries()].sort((a, b) => b[1] - a[1]);
  const shown   = entries.slice(0, 4);
  const extra   = entries.length - shown.length;

  return (
    <div className="flex items-center justify-center gap-0.5 h-3">
      {shown.map(([cls, conf]) => (
        <div
          key={cls}
          title={`${cls} (${Math.round(conf * 100)}%)`}
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: problemColor(cls),
            opacity: confidenceToOpacity(conf),
          }}
        />
      ))}
      {extra > 0 && (
        <span className="text-[7px] text-gray-500 leading-none">+{extra}</span>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function DentalChart({ teethSeg, dentalProblems }: Props) {
  const detected     = new Set(teethSeg.map(p => Number(p.class)));
  const toothProblems = mapProblemsToTeeth(teethSeg, dentalProblems);

  const uniqueCount = detected.size;
  const upperCount  = UPPER_ROW.filter(n => detected.has(n)).length;
  const lowerCount  = LOWER_ROW.filter(n => detected.has(n)).length;

  // Unique problem classes present (for legend)
  const presentClasses = [...new Set(dentalProblems.map(p => p.class))];

  function renderRow(teeth: number[], arch: 'upper' | 'lower') {
    const maxH = Math.max(...teeth.map(n => SHAPES[getType(n)].h));

    return (
      <div className="flex items-end gap-px">
        {[teeth.slice(0, 8), teeth.slice(8)].map((half, hi) => (
          <React.Fragment key={hi}>
            {half.map(n => {
              const probs = toothProblems.get(n) ?? [];
              const isUp  = arch === 'upper';
              return (
                <div
                  key={n}
                  className="flex flex-col items-center gap-0.5"
                  style={{ justifyContent: isUp ? 'flex-end' : 'flex-start' }}
                >
                  {/* Lower: dots → number → tooth */}
                  {!isUp && <ProblemDots problems={probs} />}
                  {!isUp && <span className="text-[8px] text-gray-600 leading-none">{n}</span>}

                  <div style={{ height: maxH, display: 'flex', alignItems: isUp ? 'flex-end' : 'flex-start' }}>
                    <ToothSVG n={n} detected={detected.has(n)} arch={arch} />
                  </div>

                  {/* Upper: tooth → number → dots */}
                  {isUp && <span className="text-[8px] text-gray-600 leading-none">{n}</span>}
                  {isUp && <ProblemDots problems={probs} />}
                </div>
              );
            })}
            {/* Midline gap between the two halves */}
            {hi === 0 && <div className="w-2 shrink-0" />}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-medium">Schema dentară</span>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-600 mr-1" />Sus: {upperCount}/16</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-cyan-600 mr-1" />Jos: {lowerCount}/16</span>
          <span className="text-gray-600">Total: {uniqueCount}</span>
        </div>
      </div>

      <div className="flex flex-col items-center overflow-x-auto pb-2">
        {renderRow(UPPER_ROW, 'upper')}
        <div className="h-2 w-full border-t border-b border-dashed border-gray-700 my-0.5" />
        {renderRow(LOWER_ROW, 'lower')}
      </div>

      {/* Problem legend — only show classes that are actually present */}
      {presentClasses.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-gray-800">
          {presentClasses.map(cls => (
            <div key={cls} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: problemColor(cls) }} />
              <span className="text-[9px] text-gray-500">{cls}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between mt-1.5 text-[9px] text-gray-700 select-none">
        <span>← dreapta pacient</span>
        <span>stânga pacient →</span>
      </div>
    </div>
  );
}
