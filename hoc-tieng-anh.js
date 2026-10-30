(() => {
  'use strict';
  const form = document.getElementById('enquiry-form');
  if (!form) return;
  const fields = document.getElementById('enquiry-fields');
  const button = document.getElementById('submit-button');
  const message = document.getElementById('form-message');
  const loadedAt = document.getElementById('loaded-at');
  const endpoint = form.dataset.formEndpoint.trim();
  const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const errorText = 'Chưa gửi được. Vui lòng thử lại hoặc email cho chúng tôi.';
  const controls = [...form.querySelectorAll('.field input, .field select, .field textarea')];
  let sent = false;

  loadedAt.value = String(Date.now());
  fields.disabled = false;
  form.noValidate = true;
  // campaigns.js captures UTM/session attribution before menu.js cleans the URL.
  // This dedicated source always identifies the Vietnam page, including restores.
  const identifyPage = () => { document.getElementById('traffic-source').value = 'vietnam-page'; };
  identifyPage();
  document.addEventListener('DOMContentLoaded', identifyPage, { once: true });
  window.addEventListener('pageshow', identifyPage);

  function clearErrors() {
    controls.forEach(control => {
      control.removeAttribute('aria-invalid');
      document.getElementById(control.id + '-error').textContent = '';
    });
    message.classList.remove('is-visible', 'is-success');
    message.replaceChildren();
  }
  function showMessage(text, success = false) {
    message.setAttribute('role', success ? 'status' : 'alert');
    message.setAttribute('aria-live', success ? 'polite' : 'assertive');
    message.classList.toggle('is-success', success);
    message.replaceChildren(text);
    message.classList.add('is-visible');
    message.focus();
  }
  function showError() {
    showMessage(errorText);
    const email = document.createElement('a');
    email.href = 'mailto:hello@toucanlearn.co.uk';
    email.textContent = 'hello@toucanlearn.co.uk';
    message.append(' ', email);
  }
  form.addEventListener('input', clearErrors);
  form.addEventListener('change', clearErrors);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sent || form.getAttribute('aria-busy') === 'true') return;
    clearErrors();
    identifyPage();
    controls.forEach(control => { control.value = control.value.trim(); });
    const errors = [];
    controls.forEach(control => {
      let text = '';
      if (control.validity.valueMissing) text = 'Vui lòng điền thông tin này.';
      else if (control.id === 'email' && (control.validity.typeMismatch || !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(control.value))) text = 'Vui lòng nhập địa chỉ email hợp lệ.';
      else if (control.maxLength > -1 && control.value.length > control.maxLength) text = 'Vui lòng rút ngắn thông tin này.';
      else if (!control.validity.valid) text = 'Vui lòng kiểm tra thông tin này.';
      if (!text) return;
      control.setAttribute('aria-invalid', 'true');
      document.getElementById(control.id + '-error').textContent = text;
      errors.push(control);
    });
    if (errors.length) {
      showMessage('Vui lòng kiểm tra thông tin đăng ký.');
      errors[0].focus();
      return;
    }
    const body = new URLSearchParams(new FormData(form));
    // Preserve the existing enquiry field names and the requested page context.
    // Send only values the UK enquiry form already sends, so the shared endpoint
    // accepts them: learner child/adult, lower-case format, email replies, no
    // Subject field (contact.js folds it into the message) and no non-UK phone.
    const kind = body.get('Learner') || '';
    const teacher = body.get('Preferred teacher') || 'Chưa chắc, hãy tư vấn giúp tôi';
    const contact = body.get('phone') || '';
    body.set('Learner', kind === 'Học sinh' ? 'child' : 'adult');
    if (kind === 'Học sinh' && !body.get('Age or school year')) body.set('Age or school year', 'Chưa ghi');
    body.delete('Subject');
    body.delete('Preferred teacher');
    body.delete('phone');
    body.set('Preferred format', 'online');
    body.set('Reply method', 'email');
    body.set('Town or postcode area', 'Vietnam');
    body.set('Traffic source', 'vietnam-page');
    const head = ['Subject: English (Vietnam)', 'Học viên là: ' + (kind || 'Chưa chọn'), 'Giáo viên mong muốn: ' + teacher, contact && 'Số điện thoại / Zalo: ' + contact].filter(Boolean).join('\n');
    body.set('Support requested', (head + '\n' + (body.get('Support requested') || '')).slice(0, 1000));
    const started = Number(body.get('loaded_at'));
    if (!/^\d{13}$/.test(body.get('loaded_at') || '') || started > Date.now() || Date.now() - started < 3000) {
      showMessage('Vui lòng đợi vài giây rồi gửi đăng ký.');
      return;
    }
    if (body.get('website') || !endpointPattern.test(endpoint)) {
      showError();
      return;
    }
    button.disabled = true;
    button.textContent = 'Đang gửi…';
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit', redirect: 'follow', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body, signal: controller.signal
      });
      if (!response.ok || (await response.json()).ok !== true) throw new Error('Enquiry failed');
      sent = true;
      fields.disabled = true;
      showMessage('Cảm ơn bạn! Chúng tôi sẽ liên hệ trong vòng 24 giờ.', true);
    } catch (_) {
      showError();
    } finally {
      window.clearTimeout(timeout);
      form.removeAttribute('aria-busy');
      button.disabled = sent;
      button.textContent = 'Gửi đăng ký';
    }
  });
})();
