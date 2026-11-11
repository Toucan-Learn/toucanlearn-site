import { nearVisibility } from './near-visibility.js?v=20261101-mobile-1';
// Back pages keep the showcase in a hidden tab, which never comes "near" the viewport;
// load it straight away there so its slides don't stack and stretch every panel.
if (document.querySelector('[data-content-panels] [data-showcase]')) {
  Promise.resolve(window.toucanStylesReady)
    .then(() => import('./project-showcase.js?v=20261102-mobile-calm-1'))
    .then(() => window.dispatchEvent(new Event('resize')))
    .catch(() => {});
} else {
  nearVisibility('[data-showcase]', () => import('./project-showcase.js?v=20261102-mobile-calm-1'));
}
