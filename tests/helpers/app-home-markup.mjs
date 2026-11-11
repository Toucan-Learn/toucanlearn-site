// Owner, 4 Nov: the phone homepage became the approved app layout (index-app-mock.html v2).
// Every addition is phone-only and isolated, so older homepage baselines compare without it:
// the marked block, its phone-only stylesheet and scripts, and the form endpoint hosts it
// shares with the contact page's enquiry form.
export function withoutAppHome(html) {
  return html
    .replace(/\n {4}<!-- app-home:start -->[\s\S]*?<!-- app-home:end -->\n/, '\n')
    .replace(/  <link rel="stylesheet" media="\(max-width: 767px\)" href="\/?app-home\.css[^"]*" \/>\n/, '')
    .replace(/  <script src="\/?contact\.js[^"]*"><\/script>\n  <script src="\/?app-home\.js[^"]*"><\/script>\n/, '')
    // Owner, 11 Nov: the new Google review card (Connor's parent) joined the desktop carousel.
    .replace(/\n {10}<figure class="review-quote">(?:(?!<\/figure>)[\s\S])*?Connor takes the time[\s\S]*?<\/figure>/, '')
    // Owner, 11 Nov: both Vietnamese Google reviews (Như) joined it too.
    .replace(/\n {10}<figure class="review-quote">(?:(?!<\/figure>)[\s\S])*?in Vietnam · Google review, translated[\s\S]*?<\/figure>/g, '')
    .replace("connect-src 'self' https://*.clarity.ms https://script.google.com https://script.googleusercontent.com;", "connect-src 'self' https://*.clarity.ms;");
}
