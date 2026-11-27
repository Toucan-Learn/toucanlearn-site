/* Owner, 27 Nov: tapping a price card goes to the form and notes the chosen band. */
(() => {
  'use strict';
  const field = document.getElementById('support-needed');
  const section = document.getElementById('free-session');
  if (!field || !section) return;
  document.querySelectorAll('.sen-offer .price-band').forEach(card => {
    const link = card.querySelector('.band-pick');
    if (!link) return;
    card.addEventListener('click', event => {
      event.preventDefault();
      const note = 'Interested in ' + link.dataset.band + '. ';
      const rest = field.value.replace(/^Interested in [^.]*\.\s*/, '');
      field.value = (note + rest).slice(0, Number(field.maxLength) > 0 ? field.maxLength : 200);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { try { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); } catch (_) {} }, 450);
    });
  });
})();
