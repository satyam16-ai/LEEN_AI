import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui';

export function CtaSection() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-16 text-center text-white shadow-elevated sm:px-12">
        <div
          className="pointer-events-none absolute inset-0 bg-grid opacity-[0.12]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl leading-tight font-extrabold sm:text-4xl">
            Ready to learn smarter?
          </h2>
          <p className="text-lg text-white/80">
            Create a free account and meet the teacher that never runs out of patience.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-white/90">
              <Link to="/register">
                Get started free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-white ring-1 ring-white/30 hover:bg-white/10"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
