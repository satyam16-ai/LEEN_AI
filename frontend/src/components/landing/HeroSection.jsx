import {
  ArrowRight,
  Check,
  ImageIcon,
  Mic,
  SendHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, LogoMark } from '@/components/ui';

const TRUST = ['Syllabus-aligned answers', 'Parent dashboards', 'Free for students'];

function ChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/25 via-transparent to-accent/25 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <LogoMark className="size-8" />
          <div className="flex-1">
            <p className="text-sm font-semibold">LEEN AI · Physics</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              Online now
            </p>
          </div>
        </div>

        <div className="space-y-4 bg-muted/30 p-5">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            A car speeds up from 10 m/s to 30 m/s in 4 seconds. What's its acceleration?
          </p>
          <div className="max-w-[92%] space-y-2.5 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm">
            <p>
              Use <span className="font-semibold">a = (v − u) / t</span>:
            </p>
            <ol className="space-y-1.5 text-muted-foreground">
              <li>1. u = 10 m/s, v = 30 m/s, t = 4 s</li>
              <li>2. a = (30 − 10) / 4</li>
              <li className="font-semibold text-foreground">3. a = 5 m/s²</li>
            </ol>
            <p className="text-xs text-muted-foreground">Source: Class 9 · Motion · Ch. 8</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="flex-1 text-sm text-muted-foreground">Ask your doubt…</span>
          <ImageIcon className="size-[18px] text-muted-foreground" aria-hidden="true" />
          <Mic className="size-[18px] text-muted-foreground" aria-hidden="true" />
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SendHorizontal className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="absolute -top-5 -right-3 hidden animate-float rounded-xl border border-border bg-card px-4 py-3 shadow-elevated sm:block">
        <p className="text-xs text-muted-foreground">Quiz score</p>
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          9/10
          <span className="flex items-center gap-0.5 text-xs font-semibold text-success">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            12%
          </span>
        </p>
      </div>

      <div className="absolute -bottom-6 -left-4 hidden animate-float rounded-xl border border-border bg-card px-4 py-3 shadow-elevated [animation-delay:1.5s] sm:block">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Study plan updated
        </p>
        <p className="mt-0.5 text-sm">Revise: Fractions · 20 min</p>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
        <div className="animate-rise space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary-soft-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Your AI personal teacher · available 24×7
          </span>
          <h1 className="text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-[3.5rem]">
            Learn anything, anytime — with a teacher that{' '}
            <span className="text-gradient">adapts to you</span>.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            LEEN AI solves doubts instantly, builds study plans around your weak topics and keeps
            parents in the loop — all aligned to your syllabus.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/register">
                Start learning free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {TRUST.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <ChatPreview />
        </div>
      </div>
    </section>
  );
}
