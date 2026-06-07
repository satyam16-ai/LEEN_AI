// =============================================================================
// Dashboard Page — Placeholder
// =============================================================================

import { Link } from 'react-router-dom';

export function DashboardPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-2 text-white/40">Your personalized learning hub</p>
        </div>

        {/* Coming Soon Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '📚', title: 'My Courses', description: 'Track your enrolled courses and progress' },
            { icon: '📊', title: 'Analytics', description: 'View your learning performance insights' },
            { icon: '📝', title: 'Assessments', description: 'Take tests and review results' },
            { icon: '📅', title: 'Study Plan', description: 'Your AI-generated study schedule' },
            { icon: '🏆', title: 'Achievements', description: 'Badges and milestones earned' },
            { icon: '💬', title: 'AI Tutor', description: 'Chat with your personal AI teacher' },
          ].map((card) => (
            <div key={card.title} className="glass-card p-6 group relative overflow-hidden">
              {/* Coming Soon badge */}
              <div className="absolute top-3 right-3 rounded-full bg-primary-500/10 border border-primary-500/20 px-2.5 py-0.5">
                <span className="text-xs font-medium text-primary-400">Coming Soon</span>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-2xl mb-4">
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold text-white/60 mb-1">{card.title}</h3>
              <p className="text-sm text-white/30">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Empty State */}
        <div className="mt-12 glass-card p-10 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Dashboard Under Construction
          </h2>
          <p className="text-white/40 max-w-md mx-auto mb-6">
            We&apos;re building something amazing. The dashboard features will be available soon.
            Check back later!
          </p>
          <Link
            to="/"
            className="inline-flex rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-600"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
