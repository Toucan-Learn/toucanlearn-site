(() => {
  const params = new URLSearchParams(window.location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign'];
  const read = key => {
    try { return JSON.parse(sessionStorage.getItem(key)) || {}; } catch (_) { return {}; }
  };
  const write = (key, value) => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Navigation works without storage. */ }
  };
  let attribution = read('toucan-attribution');
  if (keys.some(key => params.has(key))) {
    attribution = Object.fromEntries(keys.filter(key => params.get(key)).map(key => [key, params.get(key).slice(0, 120)]));
    write('toucan-attribution', attribution);
  }
  const fieldMap = { utm_source: 'traffic-source', utm_medium: 'traffic-medium', utm_campaign: 'campaign-name' };
  // Keep this document's context after consuming the cross-page handoff, so a
  // restored form can be hydrated again without depending on the cleaned URL.
  const enquiry = location.pathname.endsWith('/contact.html') ? read('toucan-enquiry-context') : {};
  let consumed = false;
  const fillFields = () => {
    const fields = keys.map(key => {
      const field = document.getElementById(fieldMap[key]);
      if (field && attribution[key]) field.value = attribution[key];
      return field;
    });
    const campaignSource = document.getElementById('campaign-source');
    if (!campaignSource) return false;
    const service = params.get('service') || enquiry.service;
    if (['children', 'adults', 'english-work', 'ielts', 'qualifications', 'languages', 'maths', 'in-person', 'not-sure'].includes(service)) campaignSource.value = service;
    if ((params.get('offer') || enquiry.offer) === 'launch') campaignSource.value = 'launch-offer';
    if (!consumed) {
      try { sessionStorage.removeItem('toucan-enquiry-context'); } catch (_) {}
      consumed = true;
    }
    return fields.every(Boolean);
  };
  let observer;
  if (!fillFields() && location.pathname.endsWith('/contact.html')) {
    // This script runs in the head: fill hidden controls as the parser creates
    // them, before navigation observers can read their default HTML values.
    observer = new MutationObserver(() => { if (fillFields()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', () => { fillFields(); observer?.disconnect(); }, { once: true });
  window.addEventListener('pageshow', fillFields);
  // Carry enquiry context separately from the address, including dynamically created offers.
  const rememberEnquiry = event => {
    if (event.defaultPrevented || event.button > 1) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download')) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || !target.pathname.endsWith('/contact.html')) return;
    write('toucan-enquiry-context', { service: link.dataset.service, offer: link.dataset.offer });
  };
  document.addEventListener('click', rememberEnquiry, true);
  document.addEventListener('auxclick', rememberEnquiry, true);
})();
