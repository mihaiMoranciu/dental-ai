import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  // Verificare sesiune
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session || session.value !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    const imageFile = formData.get('image') as File | null;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Promptul este obligatoriu.' }, { status: 400 });
    }

    // Construieste mesajul pentru Groq
    const userContent: object[] = [{ type: 'text', text: prompt }];

    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mimeType = imageFile.type;
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
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
        max_tokens: 1024,
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
