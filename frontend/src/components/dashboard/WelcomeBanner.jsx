import { Badge } from '@/components/ui';
import { ROLE_LABELS } from '@/features/auth/constants';
import { firstName, greeting } from '@/utils/format';

export function WelcomeBanner({ user, subtitle, children }) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-elevated sm:p-8">
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-[0.1]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl space-y-2">
          <Badge className="bg-white/15 text-white ring-1 ring-white/20">
            {ROLE_LABELS[user.role]} workspace
          </Badge>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {greeting()}, {firstName(user.name)}
          </h1>
          {subtitle && (
            <p className="text-sm leading-relaxed text-white/80 sm:text-base">{subtitle}</p>
          )}
        </div>
        {children && <div className="relative flex flex-wrap gap-2">{children}</div>}
      </div>
    </section>
  );
}
