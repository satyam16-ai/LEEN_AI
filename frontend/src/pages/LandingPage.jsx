// =============================================================================
// Landing Page — Hero, Features, About, CTA
// =============================================================================

import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🧠',
    title: 'AI-Powered Tutoring',
    description:
      'Personalized learning experiences driven by advanced AI that adapts to each student\'s pace and style.',
  },
  {
    icon: '📊',
    title: 'Smart Analytics',
    description:
      'Comprehensive performance tracking with actionable insights for students, parents, and educators.',
  },
  {
    icon: '📝',
    title: 'Adaptive Assessments',
    description:
      'Dynamic test engine that adjusts difficulty in real-time to accurately measure understanding.',
  },
  {
    icon: '📅',
    title: 'Intelligent Study Planner',
    description:
      'AI-generated study schedules optimized for retention, spaced repetition, and individual goals.',
  },
  {
    icon: '🎯',
    title: 'Goal-Oriented Learning',
    description:
      'Set learning objectives and let our AI create customized pathways to achieve them efficiently.',
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Family Dashboard',
    description:
      'Parents stay connected with real-time progress updates and meaningful engagement tools.',
  },
];

const stats = [
  { value: '10K+', label: 'Students' },
  { value: '500+', label: 'Courses' },
  { value: '95%', label: 'Satisfaction' },
  { value: '24/7', label: 'AI Support' },
];

export function LandingPage() {
  return (
    <>
      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Ambient glow */}
        <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl animate-float"
          style={{ animationDelay: '3s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary-600/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-8 animate-fade-in">
            <span className="h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
            <span className="text-xs font-medium text-primary-300 tracking-wide">
              AI-Powered Education Platform
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight animate-slide-up">
            <span className="text-white">The Future of</span>
            <br />
            <span className="gradient-text">Personalized Learning</span>
          </h1>

          {/* Subtext */}
          <p
            className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-white/50 leading-relaxed animate-slide-up"
            style={{ animationDelay: '0.15s' }}
          >
            An intelligent education platform that adapts to every student. Powered by AI, designed
            for results, built for the future of learning.
          </p>

          {/* CTA Buttons */}
          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: '0.3s' }}
          >
            <Link
              to="/register"
              className="w-full sm:w-auto rounded-xl bg-primary-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all hover:bg-primary-600 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
            >
              Start Learning Free
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white/80 backdrop-blur transition-all hover:bg-white/10 hover:text-white hover:-translate-y-0.5"
            >
              Explore Features
            </a>
          </div>

          {/* Stats */}
          <div
            className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 animate-slide-up"
            style={{ animationDelay: '0.45s' }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card p-4 sm:p-6">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="mt-1 text-xs sm:text-sm text-white/40">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES SECTION
          ============================================================ */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-400 mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Everything You Need to <span className="gradient-text">Excel</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/40">
              A comprehensive suite of AI-powered tools designed to transform the learning
              experience for students of all ages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass-card p-6 sm:p-8 group transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-1 hover:shadow-lg hover:shadow-primary-500/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-2xl mb-5 transition-transform group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          ABOUT SECTION
          ============================================================ */}
      <section id="about" className="py-24 sm:py-32 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-400 mb-3">
                About LEEN.ai
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                Reimagining Education with{' '}
                <span className="gradient-text">Artificial Intelligence</span>
              </h2>
              <p className="mt-6 text-white/40 leading-relaxed">
                LEEN.ai is built on the belief that every student deserves a personal tutor who
                understands their unique learning style, pace, and goals. Our multi-agent AI
                architecture creates adaptive learning experiences that evolve with each interaction.
              </p>
              <p className="mt-4 text-white/40 leading-relaxed">
                From intelligent study planning to real-time performance analytics, we provide the
                tools that students, parents, and educators need to unlock their full potential.
              </p>
              <div className="mt-8">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary-400 hover:text-primary-300 transition-colors group"
                >
                  Join the waitlist
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Visual Grid */}
            <div className="relative">
              <div className="glass-card p-8 sm:p-10">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: '🎓', label: 'Adaptive Learning', color: 'bg-primary-500/10' },
                    { icon: '🤖', label: 'Multi-Agent AI', color: 'bg-accent-500/10' },
                    { icon: '📈', label: 'Progress Tracking', color: 'bg-primary-500/10' },
                    { icon: '🔒', label: 'Secure & Private', color: 'bg-accent-500/10' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex flex-col items-center gap-3 rounded-xl ${item.color} p-6 transition-transform hover:scale-105`}
                    >
                      <span className="text-3xl">{item.icon}</span>
                      <span className="text-xs font-medium text-white/60 text-center">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA SECTION
          ============================================================ */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative glass-card overflow-hidden p-10 sm:p-16 text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-48 w-96 bg-primary-500/20 blur-3xl rounded-full" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Ready to Transform <span className="gradient-text">Learning</span>?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-white/40">
                Join thousands of students already using AI to achieve their academic goals. Start
                your journey today.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="w-full sm:w-auto rounded-xl bg-primary-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all hover:bg-primary-600 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
                >
                  Get Started — It&apos;s Free
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white hover:-translate-y-0.5"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
