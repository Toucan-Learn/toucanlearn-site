/* Google Ads measurement: opt-in only; never send enquiry text or contact details. */
(() => {
  'use strict';
  const tag = 'AW-18511909243';
  const lead = tag + '/4SsoCPvTh68dEPuilftE';
  const preferenceKey = 'toucan-ad-measurement';
  const params = new URLSearchParams(location.search);
  const clickKeys = ['gclid', 'gbraid', 'wbraid'];
  const initial = Object.fromEntries(clickKeys.filter(key => /^[\w-]{1,256}$/.test(params.get(key) || '')).map(key => [key, params.get(key)]));
  let preference = null, loaded = false, banner;
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (saved && Date.now() - saved.at < 180 * 86400000) preference = saved.choice;
  } catch (_) {}
  if (!['granted', 'denied'].includes(preference)) preference = null;
  const isAllowed = () => preference === 'granted';
  const attribution = () => {
    if (!isAllowed()) return {};
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('toucan-ad-click')) || {}; } catch (_) {}
    return Object.keys(initial).length ? initial : saved;
  };
  function loadTag() {
    if (!isAllowed() || loaded) return;
    loaded = true;
    const clicks = attribution();
    try { sessionStorage.setItem('toucan-ad-click', JSON.stringify(clicks)); } catch (_) {}
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' });
    window.gtag('js', new Date());
    const landing = new URL(location.origin + location.pathname);
    Object.entries(clicks).forEach(([key, value]) => landing.searchParams.set(key, value));
    window.gtag('config', tag, {
      send_page_view: false, allow_ad_personalization_signals: false,
      allow_google_signals: false, allow_enhanced_conversions: false,
      page_location: landing.href, page_referrer: '', page_title: 'Toucan Learn'
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + tag;
    document.head.appendChild(script);
  }
  function choose(choice) {
    preference = choice;
    try { localStorage.setItem(preferenceKey, JSON.stringify({ choice, at: Date.now() })); } catch (_) {}
    if (!isAllowed()) {
      try { sessionStorage.removeItem('toucan-ad-click'); sessionStorage.removeItem('toucan-attribution'); } catch (_) {}
      if (loaded) window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (!name.startsWith('_gcl_')) return;
        ['', '; domain=' + location.hostname, '; domain=.' + location.hostname].forEach(domain => {
          document.cookie = name + '=; Max-Age=0; path=/' + domain + '; SameSite=Lax';
        });
      });
    } else loadTag();
    document.dispatchEvent(new CustomEvent('toucan:measurement-consent', { detail: choice }));
    if (banner) banner.remove();
    banner = null;
  }
  function showChoices() {
    if (banner) return;
    banner = document.createElement('section');
    banner.className = 'measurement-choice';
    banner.setAttribute('aria-label', 'Advertising measurement choices');
    const text = document.createElement('p');
    text.textContent = 'May we use Google Ads cookies to see which ads lead to enquiries? Your name, contact details and message are never sent to Google Ads. You can use the whole site either way.';
    const actions = document.createElement('div');
    actions.className = 'measurement-actions';
    [['Allow measurement', 'granted'], ['No thanks', 'denied']].forEach(([label, value]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => choose(value));
      actions.appendChild(button);
    });
    const privacy = document.createElement('a');
    privacy.href = '/privacy#website-visits'; privacy.textContent = 'Privacy and choices';
    actions.appendChild(privacy);
    banner.append(text, actions); document.body.appendChild(banner);
  }
  const sentIds = new Set();
  window.toucanMeasurement = {
    allowed: isAllowed,
    fields() {
      const clicks = attribution();
      return { 'Measurement consent': isAllowed() ? 'granted' : 'denied',
        'Google click ID': clicks.gclid || '', 'Google braid': clicks.gbraid || '', 'Google web braid': clicks.wbraid || '' };
    },
    async accepted(id) {
      if (!isAllowed() || !id || sentIds.has(id) || params.get('qa') === '1') return;
      sentIds.add(id);
      loadTag();
      // This is called only after a successful backend response, never on button click.
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 1200);
        window.gtag('event', 'conversion', { send_to: lead, transaction_id: id,
          event_callback() { clearTimeout(timeout); resolve(); }, event_timeout: 1000 });
      });
    }
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-measurement-settings]');
    if (button) { showChoices(); banner.querySelector('button').focus(); }
    // Contact clicks are intent signals, never counted as successful enquiries.
    const link = event.target.closest('a[href]');
    if (!link || !isAllowed() || params.get('qa') === '1') return;
    const channel = link.href.startsWith('tel:') ? 'phone' : /^https:\/\/wa\.me\//.test(link.href) ? 'whatsapp' : null;
    if (channel && window.clarity) window.clarity('event', 'contact_' + channel + '_click');
  });
  loadTag();
  if (preference === null) showChoices();
})();
