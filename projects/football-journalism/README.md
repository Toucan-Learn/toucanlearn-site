# Football showcase

This is the journalism-only, anonymised build embedded on the Children page. It reuses the hub's newspaper component, article data, illustration and newspaper CSS. The original hub is unchanged. There is no menu, Teacher view, form, storage, backup or music code in this entry.

After adding a matchday review to the hub's `data/learning-history.ts` (`archiveWriting`) and its editorial metadata in `components/journalism-library.tsx`, refresh this folder with one command:

```sh
bash scripts/build-football-showcase.sh
```

Run this from the site checkout. Node.js 22.13+ and the hub's existing dependencies are required; the script also recognises the bundled runtime. No download is performed. The wrapper passes this checkout's path to the hub's new `scripts/build-showcase` script.

Only the new `showcase/` entry and `vite.showcase.config.ts` apply the neutral masthead, anonymisation and removal of the Record link. Normal hub builds retain their original names and navigation. A new story should use a stable ID and accurately label original writing, shared work or a summary. Never add private report text, source links or personal details.

The build uses relative assets and its own strict CSP. It preserves this README and previous generated assets. The build runs `scripts/check-showcase-static.mjs`, which rejects names, inline code and assets outside this folder. It does not publish anything. The parent slide retains `assets/projects/football-newspaper.webp` for JavaScript-disabled browsing and print; refresh that image separately if its front-page content changes.

For Claude's full browser checks, from the site checkout run `python3 -m http.server 4199`, then in another terminal run `node scripts/check-project-showcase.mjs`. Screenshots and the check report go to `../outputs/final-pass-20261028/codex-showcase/`. The check covers desktop light/dark, phone light/dark, article routes, piano input/audio, print and JavaScript-disabled fallbacks.
