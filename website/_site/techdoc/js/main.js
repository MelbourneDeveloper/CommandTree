/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DO NOT MODIFY THIS FILE DIRECTLY!  ⚠️                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  This file is part of the techdoc npm package.                          ║
 * ║  Changes here will be OVERWRITTEN when techdoc is updated.              ║
 * ║                                                                          ║
 * ║  HOW TO CUSTOMIZE:                                                       ║
 * ║  1. Create your own JS file in YOUR site: src/assets/js/custom.js       ║
 * ║  2. Add <script src="/assets/js/custom.js"></script> in your layout     ║
 * ║     (use {% block scripts %} in base.njk)                               ║
 * ║  3. Your custom.js can override any behavior by running AFTER this      ║
 * ║                                                                          ║
 * ║  NEED TO MODIFY techdoc ITSELF?                                         ║
 * ║  Edit the source in: techdoc/assets/js/                                 ║
 * ║  Then run: ./update-techdoc.sh to sync changes                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { initThemeToggle } from './theme-toggle.js';
import { initMobileMenu } from './mobile-menu.js';
import { initLanguageSwitcher } from './language-switcher.js';

initThemeToggle();
initMobileMenu();
initLanguageSwitcher();
