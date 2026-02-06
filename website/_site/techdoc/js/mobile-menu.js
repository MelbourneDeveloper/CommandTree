/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DO NOT MODIFY THIS FILE DIRECTLY!  ⚠️                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  This file is part of the techdoc npm package.                          ║
 * ║  Changes here will be OVERWRITTEN when techdoc is updated.              ║
 * ║                                                                          ║
 * ║  TO OVERRIDE: Create src/assets/js/custom.js in YOUR site and           ║
 * ║  redefine initMobileMenu() or add your own event listeners.             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Mobile menu toggle - handles sidebar visibility on mobile
 */
export function initMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar, .docs-sidebar');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !expanded);
    sidebar?.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });
}
