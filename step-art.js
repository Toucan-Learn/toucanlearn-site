(function () {
  'use strict';

  // The only art choices, shared by selection and screenshot overrides.
  const STEP_ART = {
    "step1": { "a": "/assets/art/how-step1-a.webp", "b": "/assets/art/how-step1-b.webp" },
    "step2": { "a": "/assets/art/how-step2-a.webp", "b": "/assets/art/how-step2-b.webp" },
    "step3": { "a": "/assets/art/how-step3-a.webp", "b": "/assets/art/how-step3-b.webp" }
  };

  // Classic script immediately after the steps, before lazy images are laid out.
  // Each card draws independently; an invalid override leaves that card random.
  const params = new URLSearchParams(window.location.search);
  for (const [step, art] of Object.entries(STEP_ART)) {
    const image = document.querySelector(`[data-step-art="${step}"]`);
    if (!image) continue;
    const requested = params.get(step);
    const choice = requested === 'a' || requested === 'b' ? requested : (Math.random() < 0.5 ? 'a' : 'b');
    if (image.getAttribute('src') !== art[choice]) image.src = art[choice];
  }
})();
