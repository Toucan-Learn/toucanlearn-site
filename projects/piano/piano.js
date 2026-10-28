import { initHeroKeyboard } from '../../hero-keyboard.js?v=20261026-vocal-verse-2';

// Imports and opening the keyboard are silent. A real click/touch unlocks keyboard sound.
let activated = false;
const activate = event => { if (event.isTrusted) activated = true; };
document.addEventListener('pointerdown', activate, { capture: true });
document.addEventListener('click', activate, { capture: true });
document.addEventListener('keydown', event => {
  if (!activated && !['Tab', 'Enter', ' '].includes(event.key)) event.stopImmediatePropagation();
}, { capture: true });
initHeroKeyboard(() => {});
document.getElementById('piano-toggle').click();
