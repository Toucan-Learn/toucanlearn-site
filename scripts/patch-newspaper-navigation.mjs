// Reapply after refreshing the supplied newspaper build. Keep routes in React state.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../projects/football-journalism/', import.meta.url);
const htmlURL = new URL('index.html', root);
const html = await readFile(htmlURL, 'utf8');
const script = html.match(/src="(\.\/assets\/[^"?]+\.js)/)[1];
const url = new URL(script, root);
const source = await readFile(url, 'utf8');
const marker = '/* Clean newspaper navigation. */';
if (!source.includes(marker)) {
  const route = /function te\(\)\{let\[e,t\]=\(0,d\.useState\)\(location\.hash\);[\s\S]*?return\(0,p\.jsx\)\(C,\{articleId:n\}\)\}/;
  assert(route.test(source), 'Newspaper route changed; review the refreshed build before patching.');
  const replacement = `${marker}
function te() {
  const [route, setRoute] = (0,d.useState)(location.hash);
  (0,d.useEffect)(() => {
    const navigate = hash => {
      setRoute(/^#football(?:\\/[^/]+)?$/.test(hash) ? hash : '#football');
      const path = location.pathname.replace(/\\/index\\.html$/, '/');
      if (location.hash || path !== location.pathname) history.replaceState(history.state, '', path + location.search);
      window.scrollTo(0, 0);
    };
    const incoming = () => { if (location.hash) navigate(location.hash); };
    const click = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !/^#football(?:\\/[^/]+)?$/.test(url.hash)) return;
      event.preventDefault();
      navigate(url.hash);
    };
    navigate(location.hash);
    document.addEventListener('click', click);
    window.addEventListener('hashchange', incoming);
    window.addEventListener('popstate', incoming);
    return () => {
      document.removeEventListener('click', click);
      window.removeEventListener('hashchange', incoming);
      window.removeEventListener('popstate', incoming);
    };
  }, []);
  let articleId = null;
  try { articleId = route.startsWith('#football/') ? decodeURIComponent(route.slice(10)) : null; } catch {}
  return (0,p.jsx)(C, { articleId });
}`;
  await writeFile(url, source.replace(route, () => replacement));
}
await writeFile(htmlURL, html.replace(/(src="\.\/assets\/[^"?]+\.js)(?:\?[^"\s]*)?"/, '$1?v=20261029-clean-url-1"'));
console.log('Newspaper navigation stays in the page; incoming article links still open.');
