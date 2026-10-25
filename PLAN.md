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

Pending implementation and verification.
