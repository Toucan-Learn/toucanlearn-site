// Homepage comparisons allow clean home hrefs and the existing JS cache bumps.
// Keep copy, other links, favicon tokens and unrelated stylesheets visible.
export function homeNavigationMarkup(html) {
  return html
    .replace(/href="index\.html(?=[#"])/g, 'href="./')
    .replace(/((?:menu|content-panels|team-carousel|team-deck|campaigns|launch-offer|project-showcase|project-viewer)\.js)(?:\?v=[^"]+)?(?=")/g, '$1');
}

// Back-page comparisons also account for the service handoff moving to data attributes.
export function navigationMarkup(html) {
  return homeNavigationMarkup(html)
    .replace(/href="contact\.html" data-service="([^"]*)"/g, 'href="contact.html?service=$1"');
}
