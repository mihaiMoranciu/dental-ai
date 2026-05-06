'use client';
import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Send, Paperclip, X, LogOut, Stethoscope, ActivitySquare } from 'lucide-react';
import XrayModal from '@/app/components/XrayModal';
import type { XrayAnalysis } from '@/app/types/xray';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  xrayAnalysis?: XrayAnalysis;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ── Typing dots indicator ────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-border"
         style={{ background: 'hsl(var(--card))' }}>
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: 'hsl(var(--primary))', animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

// ── Xray analysis card ───────────────────────────────────────────────────
function XrayCard({ analysis, onOpen }: { analysis: XrayAnalysis; onOpen: () => void }) {
  const uniqueTeeth = new Set(analysis.teethSeg.map(p => p.class)).size;
  return (
    <div
      className="max-w-xl w-full rounded-2xl overflow-hidden border border-border"
      style={{ background: 'hsl(var(--card))' }}
    >
      {/* Teal gradient top bar */}
      <div style={{ height: '3px', background: 'linear-gradient(to right, hsl(187, 80%, 46%), hsl(200, 80%, 60%), hsl(187, 80%, 46%))' }} />

      {/* Header row */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: 'hsl(187 80% 46% / 0.12)', border: '1px solid hsl(187 80% 46% / 0.25)' }}
          >
            <ActivitySquare className="h-4.5 w-4.5" style={{ color: 'hsl(187, 80%, 60%)' }} />
          </div>
          <div>
            <p className="text-foreground font-semibold text-sm">Analiza radiografiei</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ background: 'hsl(187 80% 46% / 0.12)', color: 'hsl(187, 80%, 68%)', border: '1px solid hsl(187 80% 46% / 0.2)' }}
              >
                {analysis.dentalProblems.length} probleme
              </span>
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ background: 'hsl(187 80% 46% / 0.08)', color: 'hsl(187, 60%, 60%)', border: '1px solid hsl(187 80% 46% / 0.15)' }}
              >
                {uniqueTeeth} dinți identificați
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpen}
          className="shrink-0 h-8 text-xs gap-1.5"
          style={{ borderColor: 'hsl(187 80% 46% / 0.3)', color: 'hsl(187, 80%, 60%)' }}
        >
          Vizualizează
        </Button>
      </div>

      <Separator />

      {/* Interpretation */}
      <div className="px-4 py-3">
        {analysis.interpretationLoading ? (
          <div className="flex items-center gap-2">
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="h-1.5 w-1.5 rounded-full animate-bounce"
                style={{ backgroundColor: 'hsl(var(--primary) / 0.6)', animationDelay: `${delay}ms` }}
              />
            ))}
            <span className="text-muted-foreground text-xs ml-1">Se genereaza interpretarea...</span>
          </div>
        ) : (
          <p className="text-foreground/90 text-sm whitespace-pre-wrap leading-relaxed">
            {analysis.interpretation}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [xrayModal, setXrayModal] = useState<XrayAnalysis | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError('');

    const userMsg: Message = { id: makeId(), role: 'user', text: prompt, imageUrl: imagePreview ?? undefined };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const fd = new FormData();
    fd.append('prompt', prompt);
    if (imageFile) fd.append('image', imageFile);
    setPrompt('');
    clearImage();

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return; }
        setError(data.error ?? 'Eroare la raspuns.');
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', text: data.reply }]);
      scrollToBottom();
    } catch {
      setError('Eroare de retea.');
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  }

  async function handleXrayAnalyze() {
    if (!imageFile || !imagePreview) return;
    setError('');
    setLoading(true);

    const capturedFile = imageFile;
    const capturedPreview = imagePreview;

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      text: 'Analizează această radiografie dentară.',
      imageUrl: capturedPreview,
    };
    setMessages(prev => [...prev, userMsg]);
    clearImage();

    try {
      const fd = new FormData();
      fd.append('image', capturedFile);
      const xrayRes = await fetch('/api/xray', { method: 'POST', body: fd });
      const xrayData = await xrayRes.json();

      if (!xrayRes.ok) {
        if (xrayRes.status === 401) { router.push('/login'); return; }
        setError(xrayData.error ?? 'Eroare la analiza radiografiei.');
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        setLoading(false);
        return;
      }

      const analysisId = makeId();
      const analysis: XrayAnalysis = {
        imageSrc: capturedPreview,
        dentalProblems: xrayData.dentalProblems,
        teethSeg: xrayData.teethSeg,
        imageWidth: xrayData.imageWidth,
        imageHeight: xrayData.imageHeight,
        interpretation: '',
        interpretationLoading: true,
      };
      setMessages(prev => [...prev, { id: analysisId, role: 'assistant', text: '', xrayAnalysis: analysis }]);
      setLoading(false);
      scrollToBottom();

      const interpretFd = new FormData();
      interpretFd.append('image', capturedFile);
      interpretFd.append('detections', JSON.stringify({
        dentalProblems: xrayData.dentalProblems,
        teethSeg: xrayData.teethSeg,
      }));
      const interpretRes = await fetch('/api/xray/interpret', { method: 'POST', body: interpretFd });
      const interpretData = await interpretRes.json();

      const interpretation = interpretRes.ok
        ? (interpretData.reply ?? '')
        : 'Eroare la generarea interpretarii.';

      updateMessage(analysisId, {
        xrayAnalysis: { ...analysis, interpretation, interpretationLoading: false },
      });
      scrollToBottom();
    } catch {
      setError('Eroare de retea.');
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'hsl(var(--background))' }}>
      {xrayModal && (
        <XrayModal
          imageSrc={xrayModal.imageSrc}
          dentalProblems={xrayModal.dentalProblems}
          teethSeg={xrayModal.teethSeg}
          imageWidth={xrayModal.imageWidth}
          imageHeight={xrayModal.imageHeight}
          onClose={() => setXrayModal(null)}
        />
      )}

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0"
        style={{ background: 'hsl(var(--card))' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'hsl(187 80% 46% / 0.12)',
              border: '1px solid hsl(187 80% 46% / 0.25)',
            }}
          >
            <Stethoscope className="h-4 w-4" style={{ color: 'hsl(187, 80%, 58%)' }} />
          </div>
          <h1 className="text-base font-bold" style={{ color: 'hsl(187, 70%, 72%)' }}>
            Dental AI
          </h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
        >
          <LogOut className="h-3.5 w-3.5" />
          Iesire
        </Button>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-6 flex flex-col gap-5 max-w-3xl w-full mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 mt-24 select-none">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'hsl(187 80% 46% / 0.08)',
                  border: '1px solid hsl(187 80% 46% / 0.18)',
                }}
              >
                <Stethoscope className="h-7 w-7" style={{ color: 'hsl(187, 80%, 55%)' }} />
              </div>
              <div className="text-center">
                <p className="text-foreground/70 text-sm font-medium">Buna ziua!</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Incarca o radiografie sau trimite un mesaj pentru a incepe.
                </p>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.imageUrl && (
                <Image
                  src={msg.imageUrl}
                  alt="imagine incarcata"
                  width={240}
                  height={240}
                  unoptimized
                  className="rounded-xl object-cover"
                  style={{ border: '1px solid hsl(var(--border))' }}
                />
              )}

              {msg.xrayAnalysis ? (
                <XrayCard
                  analysis={msg.xrayAnalysis}
                  onOpen={() => setXrayModal(msg.xrayAnalysis!)}
                />
              ) : msg.text ? (
                msg.role === 'user' ? (
                  <div
                    className="max-w-xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed font-medium"
                    style={{
                      background: 'linear-gradient(135deg, hsl(187, 76%, 40%), hsl(200, 78%, 34%))',
                      color: 'hsl(200, 30%, 96%)',
                      boxShadow: '0 4px 16px hsl(187 80% 46% / 0.18)',
                    }}
                  >
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className="max-w-xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed border-l-2"
                    style={{
                      background: 'hsl(var(--card))',
                      borderColor: 'hsl(187 80% 46% / 0.35)',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {msg.text}
                  </div>
                )
              ) : null}
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <TypingDots />
            </div>
          )}
          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div
        className="border-t border-border/60 px-4 py-4 shrink-0"
        style={{ background: 'hsl(var(--card))' }}
      >
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex flex-col gap-3">
          {/* Image preview */}
          {imagePreview && (
            <div className="relative w-20 h-20">
              <Image
                src={imagePreview}
                alt="preview"
                fill
                unoptimized
                className="rounded-xl object-cover"
                style={{ border: '1px solid hsl(187 80% 46% / 0.3)' }}
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 rounded-full w-5 h-5 text-xs flex items-center justify-center transition"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* X-ray analyze button */}
          {imageFile && (
            <button
              type="button"
              onClick={handleXrayAnalyze}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, hsl(187, 78%, 36%), hsl(200, 76%, 30%))',
                color: 'hsl(187, 60%, 90%)',
                border: '1px solid hsl(187 80% 46% / 0.3)',
                boxShadow: '0 0 20px hsl(187 80% 46% / 0.12)',
              }}
            >
              <Stethoscope className="h-4 w-4" />
              Analizeaza Radiografie Dentara
            </button>
          )}

          <div className="flex gap-2 items-end">
            {/* Upload button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={() => fileRef.current?.click()}
              title="Incarca imagine"
              style={{ borderColor: 'hsl(var(--border))' }}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />

            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as FormEvent); }
              }}
              placeholder="Scrie un mesaj... (Enter = trimite, Shift+Enter = linie noua)"
              rows={2}
              className="flex-1"
              style={{ background: 'hsl(var(--input))' }}
            />

            <Button
              type="submit"
              size="icon"
              disabled={loading || !prompt.trim()}
              className="shrink-0 h-10 w-10 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, hsl(187, 80%, 42%), hsl(200, 80%, 36%))',
                color: 'hsl(220, 30%, 4%)',
                boxShadow: prompt.trim() ? '0 0 16px hsl(187 80% 46% / 0.3)' : 'none',
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
