# Toucan Learn branch review

Reviewed 25 October 2026. **NO-GO for merging to main yet.** The consolidation is useful and the tested layouts are sound. The public example testimonials and unresolved service information need correcting first.

## Scope and evidence

- Fresh clone of `Toucan-Learn/toucanlearn-site`, branch `simplify-back-pages`, starting at `dad2921`. Main was `b91f0d3`.
- Served with `python3 -m http.server 8000 --bind 127.0.0.1`. No build step.
- Browser: Codex in-app browser, 1440 x 900 and 390 x 900, explicit light and dark themes. This is responsive browser testing, not a physical iPhone or a cross-browser certification.
- Inspected Home, Children, Adults, Approach, Team and Contact in all four combinations, including screenshots, rendered geometry and console warnings/errors. Also checked the policy, thank-you and 404 pages at both widths and themes.
- Opened [the live site](https://toucanlearn.co.uk/) in the browser. Downloaded Home, Children, Adults, Approach and Team HTML and compared the bytes with `origin/main`: all five matched. Live therefore provides a valid main comparison for those pages at review time.
- All 16 JavaScript files passed `node --check`. A parser comparison against `dad2921` confirmed that the text content of every HTML file is unchanged by these fixes.
- Parsed all HTML: 373 local `href`/`src` references resolve to existing files and fragment IDs. This does not prove email, telephone, WhatsApp or form delivery.
- Local screenshots and JSON observations are in `../outputs/growth-review-20261025/`. Books and their conversions are outside this Git repository.

## Five biggest conversion problems, ranked

| Rank | Problem and evidence | Exact next change |
| --- | --- | --- |
| 1 | **Example testimonials sit under “Kind words from our clients”.** `index.html:268`, `index.html:298-329`. Four of seven cards are labelled “Example review”. Browser keyboard navigation and a mobile pointer swipe reached one of them. This is also on live main. A small caption does not make invented customer evidence trustworthy. | Remove those four complete figures. Keep the other three only after checking their original source and publication permission. Do not invent replacements. Recheck the three-card carousel after removal. Add a way to read authentic Google reviews, separate from the existing leave-a-review link. |
| 2 | **The opening does not identify the specialist fit.** `index.html:74-83` says learning support and psychology-informed practices but never SEND. The parent route is below two team sections at `index.html:149-199`. At 390px this is a long route from a generic opening to “is this for my child?”. | Keep the approved headline if desired. Put SEND-informed tutoring, children/adults, online UK-wide and the correct in-person coverage in the next sentence. Give parents and adults direct route links near the first CTA. Do not add a claim about results. |
| 3 | **A fixed price is followed by a request to negotiate it.** The homepage price is near the bottom at `index.html:345`. It is also in `children.html:55`, `adults.html:55`, `approach.html:124` and `contact.html:81`. Yet `contact.html:127-131` asks for a desired lesson rate, and `adults.html:56` says the price is agreed before booking. | State the same £40/hour offer beside the first homepage CTA. If £40 is fixed, remove the desired-rate field and its client/server handling together. If exceptions exist, define them explicitly. Do not silently remove only the browser field because `contact.js:4-6` shares rules with an external Apps Script backend. |
| 4 | **The free diagnostic is underspecified, and cancellation language leaves risk unresolved.** `approach.html:64`, `approach.html:99-109`, `approach.html:124`, `children.html:69`, `adults.html:56`. Parents hear “diagnostic report” but cannot see the actual first-session duration, report delivery time or what they can do with it. “Flexible cancelling” has no visible notice period. | Define the free session's length, report contents, delivery time and next step. Explain that this is a tutoring assessment, not a clinical diagnosis. State the actual cancellation terms and whether any further booking is automatic. Publish a short, consented and redacted report example. Keep the grade/outcome exclusions; decide any service remedy separately. |
| 5 | **The team asks for trust without enough information to choose a tutor.** `team.html:75-79` and `index.html:170-174` use initial circles, not tutor photographs. Sara's bio is one personality sentence. Aaron and Owen have little evidence of teaching scope. Joshua's biography is substantially fuller at `team.html:63-65`. | Collect approved photos and a consistent factual profile: subjects, age/level, format/location, relevant experience and how matching works. Verify every qualification before publication. If photos are unavailable, publish useful verified text first. Avoid implying that a free trial will necessarily be with Joshua. |

These are judgements about likely friction, not measured conversion losses. There is no funnel dataset in this checkout from which to estimate a percentage uplift.

## Known issues: confirmed or rejected

| Claim | Finding |
| --- | --- |
| Four invented example quotes on Home | Confirmed four labelled example cards, publicly rendered and present on main. The brief identifies them as invented. Their customer provenance is not established by this audit. |
| No SEND wording in the hero | Confirmed for Home. Rejected as a site-wide claim: Children explicitly says SEND in its hero. |
| Thin tutor bios, no photos | Confirmed for the five tutor cards. Joshua has a detailed biography, so “all bios are thin” would be inaccurate. |
| One £40/hour price shown once | True on Home; false across the site. There are five occurrences across five pages. Keeping one clear price is sensible. Hiding it until the bottom of Home and then asking for a preferred rate is the problem. |

## Does merging the pages help?

Yes. The flat Children / Adults / Our approach / Reviews / Our team navigation removes the old nested subject menus. Children now puts SEND, six subject cards, three project stories and the included service on one route. A parent can check fit, cost and the enquiry link without guessing between overlapping subject and SEN pages. Adults retains a separate route, which is useful for avoiding child-centred messaging.

The compromise is length and loss of specificity. Children is still long on a phone. Its subject links all land at the whole Subjects section, rather than a specific subject. The tutor carousel adds more scrolling before the audience links on Home. Adult visitors to the old languages or maths URL land on Children; those redirects are technically valid but the audience choice deserves reconsideration. Approach includes descriptions of weekly-report entries marked as examples; these are illustrations, not additional verified results (`approach.html:103-107`).

Do not reverse the consolidation. Improve the first screen and factual decision information before spending time on more visual polish.

## Browser and code results

| Check | Observed result |
| --- | --- |
| Main layouts | No page-wide horizontal overflow at either width in either theme. Tutor tracks and neighbouring review cards intentionally extend inside their clipped/scrollable containers. |
| Children Subjects | Six cards, including Art. Three columns of about 373px at 1440px; one 366px column at 390px. All six subject images loaded when the section was viewed. No overlapping text or clipped Art card. |
| Header and logo | Home header remains dark in both themes. Computed LEARN colour is `rgb(69,165,155)`, exactly `#45a59b`, on Home and the back pages. Preserved. |
| Navigation | Desktop links render; mobile menu opens, Escape closes it and restores focus to its summary. Selecting Adults navigates and closes the menu. Subject anchor navigation lands below the sticky header after scrolling settles. Current-page markers were added and checked on all four merged pages at both widths. |
| Tutor carousel | Home desktop arrows reach the final cards and disable Next at the end. Team mobile Next advances about one card plus its gap and Previous works. The track remains focusable. Physical touch-device behaviour was not tested. |
| Reviews carousel | Arrow keys change the selected review and its accessible status. Pause changes to Play with `aria-pressed=true`. A horizontal pointer drag at 390px advances a review. This verifies the interaction, not the truth of the quotes. |
| Contact | Empty submission displays validation errors and focuses Your name. Child, in-person and email selections reveal the appropriate required fields; inactive phone field stays disabled. No valid enquiry was sent. Inbox receipt and the deployed backend response remain unverified. |
| Console | No warning/error entries in the captured page runs. |
| Contrast | Weak small green text and faint input borders were corrected. Gradient-backed buttons were manually reviewed because a simple flat-background calculation falsely flags them. No claim of a full WCAG audit. |

### Redirects

All six were navigated in the browser at both widths. The destination fragments exist. These are zero-delay HTML meta refreshes with fallback links and canonical URLs, not HTTP 301 responses.

| Old page | Destination |
| --- | --- |
| `sen-support.html` | `children.html#send` |
| `maths-numeracy.html` | `children.html#subjects` |
| `languages.html` | `children.html#subjects` |
| `psychology.html` | `children.html#subjects` |
| `english-for-uk-work.html` | `adults.html#adult-routes` |
| `in-person.html` | `approach.html#in-person-sessions` |

The sitemap lists the six active commercial pages and excludes these stubs. Redirect destinations were preserved because changing the intended audience is an editorial decision.

## Safe fixes committed

1. `290f7fb`: increased small-label contrast in light mode and enquiry-control border contrast in both themes. `style.css:2493` changes the small-text green from `#1f7a75` to `#17645f`. On the base light background the ratio rises from 3.99:1 to 5.40:1. `campaigns.css:467` raises border opacity from 0.22 to 0.62. Against the solid paper tokens this moves light borders from 1.48:1 to 3.57:1 and dark borders from 1.87:1 to 5.57:1. Real gradient backgrounds vary, so these are token-pair measurements. Browser-checked Contact in all four combinations and rechecked the green labels across the six main pages. Cache tokens updated.
2. `b334603`: added `aria-current="page"` and a visible underline to Children, Adults, Approach and Team in both menus. Browser-checked all four at both widths, plus the open dark mobile menu. Updated the shared stylesheet cache token on every consuming page.

No result, review, qualification, biography, price, location or guarantee copy was changed. No layout or link repair was needed based on the tests. Main was not merged or pushed.

## Decisions and merge gate

**NO-GO until these factual content fixes are made:**

1. Remove the four example testimonial figures and verify the provenance of the retained quotes. This is the hard trust blocker, even though main already has it.
2. Reconcile coverage with the brief. The site advertises in-person Bristol (`index.html:83`, `children.html:9`, `approach.html:118`), while the supplied business description specifies a Bristol base and in-person London/Henley. Use the narrower supplied coverage until Bristol availability is confirmed. Update titles/descriptions as well as visible text consistently.
3. Confirm the intended WhatsApp destination. `contact.html:183` calls `07309 639095`, but `contact.html:184` links WhatsApp to `07307 045816`. Different numbers can be intentional; the source cannot establish that. Confirm the second number or replace it with the verified business WhatsApp number before treating the enquiry route as ready.

Then rerun the affected carousel, mobile header/metadata and contact-link checks. Before active outreach, send one controlled enquiry and confirm receipt in the actual inbox; that end-to-end check was not performed here. Also settle the free-session/report terms and fixed-price versus negotiated-price decision. Photos, a shorter first screen and a report sample are high-value improvements, but do not need to hold up the merge once the factual blockers are resolved.
