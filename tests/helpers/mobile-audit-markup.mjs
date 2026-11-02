// Only the performance-discovery changes approved in audit fixes 7-9. Existing
// copy/layout tests keep their pinned historical baselines outside these tags.
export function withoutMobilePerformance(html) {
  return html
    .replace(/  <link rel="stylesheet" href="assets\/css\/opening-[^"]+" \/>\n/g, '')
    .replace(/  <link rel="stylesheet" href="opening-offer\.css[^"]+" \/>\n/g, '')
    .replace(/  <script src="deferred-styles\.js[^"]+" defer><\/script>\n/g, '')
    .replace(/\n  <noscript><link rel="stylesheet" href="[^"]+" \/><\/noscript>/g, '')
    .replace(/ data-deferred-style media="print"/g, '')
    .replace(/project-showcase-loader\.js\?v=[^"]+/g, 'project-showcase.js')
    .replace(/reviews-enquiry-sky-loader\.js\?v=[^"]+/g, 'reviews-enquiry-sky.js?v=20261031-clones-1')
    .replace(/  <link rel="preload" as="image" href="assets\/(?:galaxy-noise\.png|toucan-logo-flat(?:-256\.webp|\.png))" \/>\n/g, '')
    .replace('width="1276" height="900" loading="lazy" decoding="async" fetchpriority="low"', 'width="1276" height="900"');
}
