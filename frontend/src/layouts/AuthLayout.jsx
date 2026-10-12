import { BarChart3, CalendarCheck, Sparkles } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

import { Logo, LogoMark, ThemeToggle } from '@/components/ui';

const BENEFITS = [
  { icon: Sparkles, text: 'Instant, syllabus-aligned answers to every doubt' },
  { icon: CalendarCheck, text: 'Study plans that adapt to how you learn' },
  { icon: BarChart3, text: 'Clear progress insights for students and parents' },
];

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-[0.12]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />

      <Link to="/" className="relative w-fit rounded-lg focus-ring">
        <Logo inverted />
      </Link>

      <div className="relative max-w-md space-y-8">
        <h2 className="text-4xl leading-[1.1] font-extrabold xl:text-[2.75rem]">
          Your personal AI teacher, available 24×7.
        </h2>
        <ul className="space-y-4">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/90">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative max-w-md animate-float rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-md">
        <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm font-medium text-slate-800">
          Why does ice float on water?
        </p>
        <div className="mt-3 flex gap-3">
          <LogoMark className="size-7 shrink-0" />
          <p className="rounded-2xl rounded-tl-sm bg-white/15 px-4 py-2.5 text-sm leading-relaxed text-white/95">
            Great question! When water freezes, its molecules lock into an open hexagonal pattern —
            so ice is <strong>less dense</strong> than liquid water, and floats.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link to="/" className="rounded-lg focus-ring lg:invisible" aria-label="LEEN AI home">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md animate-rise">
            <Outlet />
          </div>
        </main>
        <footer className="px-8 pb-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} LEEN AI · Learning, personalised.
        </footer>
      </div>
    </div>
  );
}
