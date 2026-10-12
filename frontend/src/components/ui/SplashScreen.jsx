import { LogoMark } from './Logo';

export function SplashScreen() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background"
      role="status"
      aria-live="polite"
    >
      <LogoMark className="size-12 animate-pulse" />
      <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-[splash_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
