// Applies the saved theme before React renders to avoid a flash of the wrong theme.
// Kept as an external file because the production CSP forbids inline scripts.
(function () {
  try {
    var stored = localStorage.getItem('leen-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    /* storage unavailable: fall back to light */
  }
})();
