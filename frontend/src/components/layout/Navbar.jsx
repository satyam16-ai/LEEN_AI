// =============================================================================
// Navbar Component
// =============================================================================

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/#features', label: 'Features' },
  { href: '/#about', label: 'About' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/20 transition-all group-hover:bg-primary-500/30">
              <span className="text-lg font-bold text-primary-400">L</span>
            </div>
            <span className="text-lg font-bold text-white">
              LEEN<span className="text-primary-400">.ai</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary-400 ${
                  location.pathname === link.href ? 'text-primary-400' : 'text-white/70'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white hover:bg-white/5"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/25"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            type="button"
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            <span className={`h-0.5 w-6 bg-white/80 transition-all ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`h-0.5 w-6 bg-white/80 transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`h-0.5 w-6 bg-white/80 transition-all ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 pb-4 pt-2 animate-fade-in">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-sm text-white/70 hover:text-primary-400 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 px-4">
              <Link
                to="/login"
                className="rounded-lg py-2 text-center text-sm font-medium text-white/80 border border-white/10 hover:bg-white/5 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-primary-500 py-2 text-center text-sm font-medium text-white hover:bg-primary-600 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
