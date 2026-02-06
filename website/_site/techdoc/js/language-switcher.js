/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DO NOT MODIFY THIS FILE DIRECTLY!  ⚠️                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  This file is part of the techdoc npm package.                          ║
 * ║  Changes here will be OVERWRITTEN when techdoc is updated.              ║
 * ║                                                                          ║
 * ║  TO OVERRIDE: Create src/assets/js/custom.js in YOUR site and           ║
 * ║  redefine initLanguageSwitcher() or add your own event listeners.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Language switcher - handles dropdown toggle and outside click
 */
export function initLanguageSwitcher() {
  const btn = document.querySelector('.language-btn');
  const dropdown = document.querySelector('.language-dropdown');
  if (!btn || !dropdown) return;
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !expanded);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.language-switcher')) {
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}
// SYMLINK TEST - This proves changes flow through!
