# Offer wording update plan

Baseline: `562bfd8c7eb259810f3115878d51a51e066c4df8`, branch `simplify-back-pages`. Line references below refer to this baseline, before insertions. No changes to main.

## Independent jobs

| Job | Owner | Files and baseline lines | Exact scope |
| --- | --- | --- | --- |
| A: audience pages | GPT-6 Luna, low reasoning | `children.html:55,69`; `adults.html:55-56` | Rename the free offer, add `from` to the rate, add the approved assessment explanation immediately after each hero offer, replace the two cancellation passages. Retain `Pay weekly.` as a separate sentence. |
| B: contact and tutor availability | GPT-6 Luna, low reasoning | `contact.html:81,128,130,170`; `team.html:77` | Rename the offer, add `from`, change the cost label and hint, insert cost reassurance immediately before the submit button, append Chemi's Bristol availability to the role. Preserve every form attribute. |
| C: wording decisions and homepage layout | Lead planner | `index.html:9,12,21,75-79,172,234,344-345`; `hero.css:31,39-41,73,90-91`; `approach.html:56-57,124`; `privacy.html:72-73` | Exact requested hero and metadata; visible offer before first hero CTA; reassurance next to that CTA; Chemi availability; rename homepage step text and bottom offer; compact offer CSS and its cache token; assessment explanation on Approach; preserve its step-1 exception at line 64; align privacy language with the renamed cost field and preserve its clinical-record restriction. |
| D: independent verification and integration | Lead planner | `PLAN.md` and local evidence outside the repo | Inspect all worker diffs, compare protected content against baseline, run source/link/anchor checks, personally test the combined site in the browser, record outcomes, commit small groups and push only this branch. |

Workers receive only their file lists, exact substitutions and constraints. They do not commit, push, change CSS or claim browser verification. Jobs A and B have no shared files. Two workers avoid the overhead of delegating individual one-line changes. GPT-6 Luna is the available model described as fast and affordable; no live price table is available, so cost estimates will not claim a measured cash saving.

## Approved text and decisions

- Hero and both description metadata fields: `SEND-informed tutoring for children and adults, led by Joshua and the Toucan team. Online across the UK, in person in Bristol, London and Henley (for now).`
- Offer: `Your first session and learning assessment are free. After that, from £40 per hour.` Preserve existing planning/review inclusions where present.
- Assessment explanation on Children, Adults and Approach: `The first session is about an hour. Your written learning assessment arrives within two days and is yours to keep whether or not you continue. It is a tutor's assessment of how the learner learns, not a clinical or formal SEND assessment.`
- Reassurance on Home and Contact: `If cost is a worry, tell us and we'll find something that works.` On Contact, place it immediately before the form's submit CTA.
- Cost label: `Anything that affects cost for you? (optional)`; hint: `Tell us what would make lessons affordable for you.` Keep `name="Desired lesson rate"`, `maxlength="60"` and all validation unchanged.
- Chemi role: `Spanish, English and SEN support (primary) · Online and in person (Bristol)` on both cards. Sara's card is unchanged.
- Cancellation: retain `Pay weekly.` then use the requested `Cancel or reschedule any time. We ask for 24 hours' notice where you can give it, and we're flexible when life gets in the way.`
- Home's step text becomes `We use the first free trial as a learning assessment to get to know you and the best ways we can support you.` Only the Approach step-1 phrase `live-diagnostic session` is exempt.
- Privacy: use `optional information about what affects cost for you` in the collection description. Replace `diagnoses` with `clinical assessment records`; this is a clinical-record restriction, not the name of the tutoring offer.
- `contact.js` and `thank-you.html` have no matching diagnostic wording. Verify and leave them unchanged. Historical review reports describe the earlier snapshot and are not public website copy; leave them unchanged and list their search matches separately.
- Bump `hero.css`'s query token in its only HTML reference if CSS changes. No gratuitous bumps to unchanged scripts or stylesheets. HTML documents have no asset version query to update.

## Protected content

Preserve all four Example review cards byte for byte, every Apps Script file, all form field names and limits, all of `contact.js`, all results and guarantee copy, the main headline, existing Bristol/London/Henley coverage, and Sara's availability wording. Do not invent claims. The assessment delivery terms come directly from the owner's instruction.

## Verification before push

1. Confirm branch and inspect diffs. Compare protected snippets and form schemas with baseline by code.
2. Check every local HTML asset, link and fragment, including redirect destinations. Parse all JavaScript. Search `diagnos`, old prices and cancellation wording.
3. Serve via `python3 -m http.server 8000`. At 1440px and 390px in both themes, inspect all changed pages, visible offers, assessment text, subject grid, overflow, console errors and header.
4. Personally exercise mobile navigation, both homepage carousels, keyboard access, contact required-field validation and conditional fields. Do not submit a valid enquiry or send test data to Apps Script.
5. Record exact test results and any limitation here. Commit in small groups, then push `HEAD:refs/heads/simplify-back-pages` and verify remote HEAD. Never merge or push main.

## Execution record

Jobs A and B completed by GPT-6 Luna with low reasoning. The lead inspected both diffs and performed the browser checks independently. No worker committed or pushed.

### Owner correction during verification

The owner rejected the brighter LEARN green and the revised cost question, and asked to remove the form's "keep it brief" and medical-details guidance. This later instruction supersedes the cost-label and hint text above.

Job E is handled by the lead because it requires interpreting the correction and tracing the original colours, and another worker would add overhead:

- `contact.html:124,128,130`: keep only `The subject or goal, and what's tricky at the moment.` as the support hint; restore `What's your desired lesson rate?` and `Optional. A rough figure per session is fine.` No form attributes or validation changes.
- `privacy.html:60,72`: update the revision date to 25 October 2026 and retain the original desired-rate collection description to match the restored question.
- `style.css:118-120,2493,2522,2554` and `hero.css:14`: restore main's original logo colours, `#1f7a75` in light mode and `#45a59b` in dark mode. Give the logo its own variable so the earlier contrast correction to small text is retained.
- All eleven full HTML pages that reference `style.css`, including policy, thank-you and 404 pages: bump its cache token. Bump the changed `hero.css` token in `index.html` again. These additional pages receive version-query changes only.
- Recheck both headers and the form in both widths and themes, plus links, protected content and source syntax, before committing and pushing.

### Results

- Implemented A in `fd4e138`, B plus the form correction in `bf019c6`, and the homepage/Approach/logo work in `1b5dd11`. The original plan was committed first as `d2c3a0a`.
- Final browser matrix: Home, Children, Adults, Approach, Contact, Team and Privacy at 1440 x 900 and 390 x 844, each in light and dark mode, 28 page states. No document overflow, broken loaded images, console warnings or console errors were reported. The lead inspected screenshots, including the revised form and Chemi's card.
- Computed logo colour on both Home and Contact: `rgb(31, 122, 117)` in light mode and `rgb(69, 165, 155)` in dark mode, matching main's original colours. The homepage header remains dark in both modes. The mobile header retains its Home treatment.
- Both homepage carousels were exercised in all four viewport/theme combinations. Tutor next/previous controls moved the track and the next control disabled at the end. Review keyboard arrows changed the displayed review and returned it, and pause/resume changed the control state. The Team page's tutor track and Chemi's longer role were also checked. One test loop attempted an extra click as smooth scrolling disabled Next; inspecting the end state confirmed the expected behaviour.
- Mobile Menu opened in both themes, contained six links, navigated to Children, marked the current page, closed on Escape with focus returned to its summary, and reached the Children enquiry URL. The Subjects grid has three desktop columns and one mobile column, with all six subjects including Art.
- Contact validation was exercised in all four viewport/theme combinations: empty submissions, child age, in-person location, invalid email, all three phone reply methods, the unchanged 60-character cost limit, and hidden/disabled conditional fields. Focus returned to the first invalid field. Fifteen additional local validation cases passed, including valid adult/child data, 60/61-character boundaries, valid UK phone numbers, unknown fields and the three-second minimum. No valid enquiry was submitted and Apps Script delivery was not tested.
- Static checks: 17 HTML pages, 373 local file/link/fragment references, no missing targets or duplicate IDs; 16 JavaScript files passed syntax checking. All six legacy redirects also reached the correct existing anchors in the browser.
- Protected comparisons passed: all seven review cards, including the four Example cards, are byte-for-byte unchanged; all form attributes, field names, limits and `contact.js` are unchanged; the headline and other tutor cards are unchanged. No Apps Script, results or guarantee copy was edited.
- Changed assets are `hero.css` and `style.css`. Their references use `20261025-offer-96` and `20261025-logo-96` respectively. All eleven full HTML pages load the updated main stylesheet; Thank-you, 404, Complaints and Safeguarding otherwise match the baseline.
- Evidence is saved outside the repository in `../outputs/offer-update-20261025/`: `browser-audit.json`, `interaction-audit.json`, `static-checks.json`, `validation-rules.json`, and screenshots. The final browser matrix was repeated after the owner's form/logo correction.

### Remaining search matches

The public website's only case-insensitive `diagnos` match is `approach.html:65`: `live-diagnostic session`, the requested exception. No matching message exists in `contact.js`; Thank-you needed only the stylesheet cache bump.

Historical reports are unchanged snapshots of the earlier offer: `review.md:23`; `offer-review.md:3,27,33,45`; `lead-plan.md:24,49,65,103,109`. They still contain diagnostic/diagnosis wording. This plan also mentions the search term and exception as documentation. Those old outreach templates should use the newly approved offer when actually used.

### Delegation cost estimate

Two mechanical jobs ran on GPT-6 Luna, low reasoning, without conversation history. The lead handled wording decisions, the rename exception, CSS, the owner's correction, integration and all browser verification. No further jobs were delegated because the remaining changes were too small or required judgment.

Usage and billing totals for workers are not exposed by these tools. A rough estimate is 1,000 to 2,000 lead-model editing tokens displaced, offset by 2,000 to 4,000 worker and coordination tokens, excluding inherited tool instructions and caching effects. That is roughly 1,000 to 3,000 extra task tokens overall, with no measured cash saving. This batch was small enough that delegation probably offered little economic benefit; direct editing would be preferable for a similar correction.

The requested branch changes pass these checks. The earlier merge recommendation remains NO-GO while the Example review cards remain; the owner explicitly reserved their replacement. No merge to main is part of this work.
