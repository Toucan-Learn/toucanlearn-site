// Homepage comparisons allow clean home hrefs and the existing JS cache bumps.
// Keep copy, other links, favicon tokens and unrelated stylesheets visible.
// 29 Oct: page links dropped .html (Pages serves /subjects for subjects.html).
const pages = '404|adults|approach|children|complaints|contact|english-for-uk-work|ielts|in-person|languages|maths-numeracy|privacy|psychology|safeguarding|sen-support|subjects|team|thank-you';
const cleanPage = new RegExp(`((?:href|content|data-legacy-destination)="(?:https://toucanlearn\\.co\\.uk/)?)(${pages})(?=[#"?])`, 'g');
export function homeNavigationMarkup(html) {
  return html
    // 31 Oct: only the new language disclosures and head metadata are exempt.
    // language-pages-source.mjs checks their complete contents separately.
    .replace(/<details class="(?:nav-item|mobile-nav-item) language-switch">[\s\S]*?<\/details>/g, '')
    .replace(/  <link rel="alternate" hreflang="(?:en-GB|vi|es|fr|it|x-default)" href="[^"]+" \/>\n/g, '')
    .replace(/  <link rel="stylesheet" href="language-switch\.css\?v=[^"]+" \/>\n/g, '')
    .replace(/  <script src="language-switch\.js\?v=[^"]+" defer><\/script>\n/g, '')
    .replace(cleanPage, '$1$2.html')
    .replace(/href="index\.html(?=[#"])/g, 'href="./')
    .replace(/((?:menu|content-panels|team-carousel|team-deck|campaigns|launch-offer|project-showcase|project-viewer)\.js)(?:\?v=[^"]+)?(?=")/g, '$1');
}

// Back-page comparisons also account for the service handoff moving to data attributes.
export function navigationMarkup(html) {
  return homeNavigationMarkup(html)
    .replace(/href="contact\.html" data-service="([^"]*)"/g, 'href="contact.html?service=$1"');
}
