import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const MODELS = {
  dentalProblems: {
    id: 'new-final-dataset-eqnh8-u9syy',
    version: 2,
    confidence: '20',
    overlap: '40',
    endpoint: 'detect.roboflow.com',
  },
  teethSeg: {
    id: 'teeth-seg-3537-iaky1',
    version: 1,
    // Low confidence to catch all teeth; NMS (overlap=30) removes duplicates.
    // False positives outside the mouth are removed client-side by removeToothOutliers().
    confidence: '5',
    overlap: '30',
    endpoint: 'serverless.roboflow.com',
  },
};

interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
  points?: { x: number; y: number }[];
}

interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image?: { width: number; height: number };
}

// Removes isolated teeth detections that have no neighbor within 2.5× the average
// tooth diagonal. Real teeth are tightly grouped in the dental arch; false positives
// in the image periphery are isolated and have no nearby teeth.
function removeToothOutliers(preds: RoboflowPrediction[]): RoboflowPrediction[] {
  if (preds.length < 4) return preds;

  const avgDiag =
    preds.reduce((s, p) => s + Math.hypot(p.width, p.height), 0) / preds.length;
  const radius = avgDiag * 2.5;

  return preds.filter(p =>
    preds.some(
      other => other !== p && Math.hypot(p.x - other.x, p.y - other.y) < radius,
    ),
  );
}

// When the same tooth class appears multiple times, keep only the highest-confidence one.
function deduplicateByClass(preds: RoboflowPrediction[]): RoboflowPrediction[] {
  const best = new Map<string, RoboflowPrediction>();
  for (const p of preds) {
    const existing = best.get(p.class);
    if (!existing || p.confidence > existing.confidence) best.set(p.class, p);
  }
  return Array.from(best.values());
}

function boxIoU(a: RoboflowPrediction, b: RoboflowPrediction): number {
  const ax1 = a.x - a.width / 2,  ay1 = a.y - a.height / 2;
  const ax2 = a.x + a.width / 2,  ay2 = a.y + a.height / 2;
  const bx1 = b.x - b.width / 2,  by1 = b.y - b.height / 2;
  const bx2 = b.x + b.width / 2,  by2 = b.y + b.height / 2;
  const inter = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1))
              * Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  if (inter === 0) return 0;
  return inter / ((ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter);
}

// Greedy NMS across different classes: if two different teeth overlap too much,
// drop the lower-confidence one (likely a mislabelled duplicate).
function nmsAcrossClasses(preds: RoboflowPrediction[], iouThreshold = 0.3): RoboflowPrediction[] {
  const sorted = [...preds].sort((a, b) => b.confidence - a.confidence);
  const keep: RoboflowPrediction[] = [];
  for (const pred of sorted) {
    if (!keep.some(k => boxIoU(pred, k) > iouThreshold)) keep.push(pred);
  }
  return keep;
}

async function callRoboflow(
  modelId: string,
  version: number,
  confidence: string,
  overlap: string,
  base64: string,
  endpoint: string,
): Promise<RoboflowResponse> {
  const params = new URLSearchParams({
    api_key: process.env.ROBOFLOW_API_KEY!,
    confidence,
    overlap,
    format: 'json',
  });

  const res = await fetch(`https://${endpoint}/${modelId}/${version}?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: base64,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Roboflow error ${res.status}`);
  }

  return res.json();
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session || session.value !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: 'Imaginea este obligatorie.' }, { status: 400 });
    }

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const [dentalResult, teethResult] = await Promise.all([
      callRoboflow(
        MODELS.dentalProblems.id, MODELS.dentalProblems.version,
        MODELS.dentalProblems.confidence, MODELS.dentalProblems.overlap,
        base64, MODELS.dentalProblems.endpoint,
      ),
      callRoboflow(
        MODELS.teethSeg.id, MODELS.teethSeg.version,
        MODELS.teethSeg.confidence, MODELS.teethSeg.overlap,
        base64, MODELS.teethSeg.endpoint,
      ),
    ]);

    const cleanTeeth = nmsAcrossClasses(
      deduplicateByClass(
        removeToothOutliers(teethResult.predictions ?? [])
      )
    );

    return NextResponse.json({
      dentalProblems: dentalResult.predictions ?? [],
      teethSeg:       cleanTeeth,
      imageWidth:     dentalResult.image?.width  ?? 0,
      imageHeight:    dentalResult.image?.height ?? 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Eroare necunoscuta';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
