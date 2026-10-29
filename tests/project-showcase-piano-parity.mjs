// Side-by-side code audit (opening cell vs children.html#learner-projects):
// - DOM, five hero modules, songs, voices, tempo, keyboard span/ratios, sky and
//   note cues already share one implementation. No alternate piano is needed.
// - Caption toggle was outside .piano-world; only the opening inherited hero
//   variables and expanded/hover/focus styles. Give BOTH the same piano scope.
// - Projects changed the panel-inner edge to rounded-at-top. Remove that rule.
// - Projects used 0 horizontal panel insets vs the opening's -1px: its keyboard
//   was 2px narrower. Retain the original width and intrinsic key size ratios.
// - Back-page img rules gave the mascot contain fitting vs the opening's fill.
//   Match fill; the existing 51%, auto, no-cap, square-box protections already
//   neutralised the other back-page image rules and remain in place.
// - Projects anchors/clips the panel inside its smaller cell; the opening drops
//   it below its caption. This placement/containment is the sole fit exception.
// - The existing hero colours are green/violet (despite older orange/green copy).
//   Compare the actual hero colours; do not silently change the homepage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const keyboard = await readFile(new URL('../hero-keyboard.js', import.meta.url), 'utf8');
const pianoPath = keyboard.match(/from '(\.\/hero-piano\.js[^']*)'/)[1];

export async function capturePianoParity(page) {
  const sheet = await page.addStyleTag({ url: new URL('tests/fixtures/piano-parity.css', page.url()).href });
  try {
    await page.keyboard.press('Tab'); // Compare real :focus-visible styling on both routes.
    return await page.evaluate(async path => {
      const api = await import(path);
      // Reset to the same first attack without touching song or voice settings.
      const choices = api.availableSongs();
      do { api.nextSong(); } while (api.currentSong().id !== 'runaway');
      document.activeElement?.blur();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const properties = ['display', 'visibility', 'color', 'background', 'box-shadow', 'border', 'border-radius', 'padding', 'margin',
        'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'height', 'width', 'min-width',
        'grid-template-columns', 'gap', 'transform', 'opacity', 'object-fit', 'image-rendering', 'cursor', 'touch-action'];
      const snapshot = () => {
        const world = document.querySelector('.showcase-stage > .piano-world');
        const toggle = document.querySelector('#piano-toggle');
        const nodes = [world, ...world.querySelectorAll('*'), toggle, ...toggle.querySelectorAll('*')];
        return { world: world.outerHTML, toggle: toggle.outerHTML, styles: nodes.map(node => {
          const css = getComputedStyle(node);
          return { node: `${node.tagName}.${node.className?.baseVal ?? node.className}`, values: Object.fromEntries(properties.map(name => [name, css.getPropertyValue(name)])),
            keyPosition: node.matches('.piano-key--black') ? { left: css.left, top: css.top } : null };
        }), voice: api.currentVoicePreset(), song: api.currentSong().id, bpm: api.noteTiming().bpm };
      };
      const songs = [];
      for (let i = 0; i < choices.length; i++) {
        songs.push(snapshot());
        document.querySelector('.piano-next').click();
        if (document.querySelector('#hero-keyboard').dataset.song !== api.currentSong().id) throw new Error('Song control failed to update the shared keyboard');
      }
      const toggle = document.querySelector('#piano-toggle');
      toggle.focus({ preventScroll: true });
      const focused = { outline: getComputedStyle(toggle).outline, offset: getComputedStyle(toggle).outlineOffset };
      toggle.click();
      const closed = snapshot();
      toggle.click();
      return { songs, focused, closed };
    }, new URL(pianoPath, page.url()).href);
  } finally { await sheet.evaluate(node => node.remove()); }
}

export function assertPianoParity(home, projects, label) {
  assert.deepEqual(projects, home, `${label}: Projects piano DOM, sky, controls, every song/voice, tempo, cue colours and intrinsic keyboard ratios must exactly match the opening`);
}
