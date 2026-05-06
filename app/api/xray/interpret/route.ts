import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { Prediction } from '@/app/types/xray';

interface DetectionData {
  dentalProblems: Prediction[];
  teethSeg: Prediction[];
}

// Only include detections at or above this threshold in the Grok summary.
// The canvas still shows everything (filtered client-side by the doctor).
const INTERPRET_CONFIDENCE_THRESHOLD = 0.20;

function buildPrompt({ dentalProblems, teethSeg }: DetectionData): string {
  // Filter noise for the Grok summary — very low-confidence detections skew the counts
  const significantProblems = dentalProblems.filter(p => p.confidence >= INTERPRET_CONFIDENCE_THRESHOLD);

  const byClass: Record<string, number[]> = {};
  for (const p of significantProblems) {
    (byClass[p.class] ??= []).push(p.confidence);
  }

  const problemLines = Object.entries(byClass)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cls, confs]) => {
      const avg = Math.round(confs.reduce((a, b) => a + b, 0) / confs.length * 100);
      const min = Math.round(Math.min(...confs) * 100);
      const max = Math.round(Math.max(...confs) * 100);
      return `  • ${cls}: ${confs.length} detecție/detecții (confidence: ${min}%–${max}%, medie: ${avg}%)`;
    })
    .join('\n');

  const teethCount = new Set(teethSeg.map(p => p.class)).size;
  const threshold = Math.round(INTERPRET_CONFIDENCE_THRESHOLD * 100);

  return `Ești un medic radiolog dentar virtual cu experiență clinică vastă. Analizează radiografia dentară atașată împreună cu rezultatele analizei automate prin AI și furnizează o interpretare clinică profesională.

REZULTATELE ANALIZEI AUTOMATE:
────────────────────────────────
PROBLEME DENTARE DETECTATE (confidence ≥${threshold}%, ${significantProblems.length} detecții relevante):
${problemLines || '  • Nicio problemă semnificativă detectată'}

SEGMENTARE DINȚI:
  • Dinți identificați: ${teethCount}
────────────────────────────────

Pe baza imaginii și a datelor de mai sus, oferă o interpretare clinică structurată cu:

1. REZUMAT GENERAL – starea generală a dentiției
2. CONSTATĂRI PRINCIPALE – descrie fiecare categorie de probleme, importanța clinică și localizarea aproximativă
3. SEVERITATE ȘI URGENȚĂ – clasifică problemele detectate (urgent / monitorizare / rutină)
4. RECOMANDĂRI CLINICE – intervenții indicate
5. OBSERVAȚII – orice altceva relevant observabil în radiografie

Fii precis, profesional și concis. Răspunde în limba română.
⚠️ Această analiză este generată automat de AI și trebuie confirmată de un medic stomatolog calificat.`;
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
    const detectionsJson = formData.get('detections') as string | null;

    if (!detectionsJson) {
      return NextResponse.json({ error: 'Detectiile sunt obligatorii.' }, { status: 400 });
    }

    const detections = JSON.parse(detectionsJson) as DetectionData;
    const prompt = buildPrompt(detections);

    const userContent: object[] = [{ type: 'text', text: prompt }];

    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${imageFile.type};base64,${base64}` },
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message ?? 'Eroare Groq' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Eroare necunoscuta';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
