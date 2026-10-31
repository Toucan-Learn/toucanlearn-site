/* Owner, 31 Oct: Microsoft Clarity shows how visitors use the site. It runs without cookies (each page is its own
   recording), so there is no cookie banner; visitors can switch it off on the privacy page. */
(() => {
  'use strict';
  const projectId = 'z68bw8zawq';
  const storageKey = 'toucan-clarity-off';

  function isOff() {
    try { return window.localStorage.getItem(storageKey) === '1'; } catch (_) { return false; }
  }

  document.querySelectorAll('[data-clarity-toggle]').forEach(button => {
    button.textContent = isOff() ? 'Turn Clarity back on' : 'Turn off Clarity on this browser';
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-clarity-toggle]')) return;
    try {
      if (isOff()) window.localStorage.removeItem(storageKey); else window.localStorage.setItem(storageKey, '1');
    } catch (_) { /* Without storage the choice cannot be kept. */ }
    window.location.reload();
  });

  if (isOff()) return;
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
  window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  document.head.appendChild(script);
})();
