/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DO NOT MODIFY THIS FILE DIRECTLY!  ⚠️                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  This file is part of the techdoc npm package.                          ║
 * ║  Changes here will be OVERWRITTEN when techdoc is updated.              ║
 * ║                                                                          ║
 * ║  TO OVERRIDE: Create src/assets/js/custom.js in YOUR site and           ║
 * ║  redefine initThemeToggle() or add your own event listeners.            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Theme toggle - switches between light/dark modes
 */
export function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}
