// Compare contact content and behaviour hooks while allowing layout wrappers,
// cache bumps, the optional Subject field, the shorter textarea and removed hint.
import { navigationMarkup } from './navigation-markup.mjs';
export function contactMarkup(source) {
  const divs = [];
  return navigationMarkup(source)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/contact\.css\?v=[^"]+/g, 'contact.css')
    .replace(/contact\.js\?v=[^"]+/g, 'contact.js')
    .replace(/<label for="subject">Subject \(optional\)<\/label>\s*<select id="subject"[^>]*>[\s\S]*?<\/select>\s*<span class="field-error" id="subject-error"><\/span>/g, '')
    .replace(/<small id="support-needed-hint">[\s\S]*?<\/small>/g, '')
    .replace('support-needed-hint support-needed-error', 'support-needed-error')
    .replace(/<textarea id="support-needed"[^>]*>/g, tag => tag.replace(/ rows="\d+"/, ''))
    .replace(/<\/?div\b[^>]*>/g, tag => {
      if (tag.startsWith('</')) return divs.pop() ? '' : tag;
      const layoutOnly = /^<div(?: class="[^"]*")?>$/.test(tag);
      divs.push(layoutOnly);
      return layoutOnly ? '' : tag;
    })
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

// All existing validation, conditional logic and submission code stays intact.
// Dedicated contact tests exercise the optional Subject additions separately.
export function contactScript(source) {
  return source
    .replace('"Subject": 40, ', '')
    .replace(/^    choice\("Subject",[^\n]+\n/m, '')
    .replace('"Subject": "subject", ', '');
}
