// =============================================================================
// Login Page — Placeholder
// =============================================================================

import { Link } from 'react-router-dom';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/20">
                <span className="text-xl font-bold text-primary-400">L</span>
              </div>
              <span className="text-xl font-bold text-white">
                LEEN<span className="text-primary-400">.ai</span>
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-white/40">Sign in to continue your learning journey</p>
          </div>

          {/* Form (placeholder — no logic) */}
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-white/60 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-primary-500/50 focus:bg-white/[0.07]"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-white/60 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-primary-500/50 focus:bg-white/[0.07]"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-white/40 cursor-pointer">
                <input type="checkbox" className="rounded border-white/20 bg-white/5 accent-primary-500" />
                Remember me
              </label>
              <a href="#" className="text-primary-400 hover:text-primary-300 transition-colors">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/25"
            >
              Sign In
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-white/40">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 transition-colors font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
