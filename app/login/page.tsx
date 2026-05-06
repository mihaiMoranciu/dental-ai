'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Eroare la logare.');
      } else {
        router.push('/chat');
      }
    } catch {
      setError('Eroare de retea.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Ambient teal glow behind card */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(187 80% 46% / 0.07) 0%, transparent 65%)' }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(187 80% 16%), hsl(220 28% 10%))',
                border: '1px solid hsl(187 80% 46% / 0.35)',
                boxShadow: '0 0 28px hsl(187 80% 46% / 0.15)',
              }}
            >
              <Stethoscope className="h-8 w-8" style={{ color: 'hsl(187, 80%, 62%)' }} />
            </div>
            {/* Blur halo */}
            <div
              className="absolute inset-0 rounded-2xl -z-10 blur-2xl"
              style={{ background: 'hsl(187 80% 46% / 0.18)' }}
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dental AI</h1>
          <p className="text-muted-foreground text-sm mt-1">Analiza radiografii dentare</p>
        </div>

        {/* Card */}
        <Card
          style={{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            boxShadow: '0 0 0 1px hsl(187 80% 46% / 0.08), 0 24px 48px hsl(220 30% 2% / 0.6)',
          }}
        >
          {/* Teal top stripe */}
          <div
            className="h-[2px] w-full rounded-t-xl"
            style={{ background: 'linear-gradient(to right, transparent, hsl(187, 80%, 46%), transparent)' }}
          />
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-foreground/80">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  style={{ background: 'hsl(var(--input))', borderColor: 'hsl(var(--border))' }}
                  className="focus-visible:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-foreground/80">Parola</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ background: 'hsl(var(--input))', borderColor: 'hsl(var(--border))' }}
                  className="focus-visible:ring-primary/50"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-1 font-semibold"
                style={{
                  background: loading
                    ? 'hsl(var(--muted))'
                    : 'linear-gradient(135deg, hsl(187, 80%, 42%), hsl(200, 80%, 36%))',
                  color: loading ? 'hsl(var(--muted-foreground))' : 'hsl(220, 30%, 4%)',
                  boxShadow: loading ? 'none' : '0 0 20px hsl(187 80% 46% / 0.25)',
                }}
              >
                {loading ? 'Se autentifica...' : 'Intra'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-5">
          Sistem AI pentru analiza radiografiilor dentare
        </p>
      </div>
    </main>
  );
}
