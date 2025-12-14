# Repository Guidelines

## Project Structure & Module Organization
- Static site built with Jekyll; `index.html` only holds front matter and defers to `_layouts/default.html` for page assembly.
- `_layouts/default.html` stitches partials from `_includes/` (`head.html` for meta/assets, `header.html` for hero/social buttons, optional `page_content.html` and `contact.html` sections, `footer.html`, `js.html`). Add new sections as includes and wire them into the layout.
- Assets live in `css/`, `js/`, and `fonts/`; keep third-party libraries pinned here. Site-wide metadata, social links, and domain settings live in `_config.yml` and `CNAME`.
- Blog-style content can follow the standard `_posts/YYYY-MM-DD-title.md` pattern; pair images with `img/services/<file>` to match the existing post loop in `page_content.html`.

## Build, Test, and Development Commands
- `bundle exec jekyll serve --livereload --trace` — run the site locally at `http://127.0.0.1:4000` with file watching.
- `bundle exec jekyll build` — compile into `_site/` for inspection or deployment.
- `JEKYLL_ENV=production bundle exec jekyll build` — mirror the production build (analytics enabled, production URLs).

## Coding Style & Naming Conventions
- YAML front matter uses two-space indents and lowercase keys; keep titles and subtitles concise.
- Match the surrounding HTML/Liquid indentation (tabs/four spaces) and rely on Bootstrap-friendly class names; avoid inline styles when a CSS class exists.
- CSS in `css/landing-page.css` uses four-space indents and double quotes; keep vendor files (`bootstrap.css`) untouched and place custom rules near related sections.
- JavaScript in `js/landing-page.js` is jQuery-based; keep functions small, attach behaviors after DOM ready, and prefer descriptive selector names over IDs.

## Testing Guidelines
- No automated test suite; rely on manual smoke tests after `bundle exec jekyll serve`.
- Verify social links from `_config.yml` render and open correctly, hero layout scales on mobile, scroll/spy interactions still work, and the GA snippet remains intact.
- Check for console errors in both desktop and mobile views before merging.

## Commit & Pull Request Guidelines
- Git history favors short, imperative summaries (e.g., `add type for podcast`); keep commits scoped and focused on one change.
- Pull requests should note what changed, why, and how to validate (commands plus manual checks). Include screenshots or screen recordings for UI tweaks.
- Call out edits to deployment-sensitive files (`_config.yml`, `CNAME`, external script sources) so reviewers can confirm domain and analytics details.

## Security & Configuration Tips
- Keep third-party IDs (GA, Font Awesome kit) in `_config.yml`/`head.html`; avoid committing secrets or temporary tokens.
- Prefer local assets in `css/`, `js/`, `fonts/`, or `img/` over hotlinks to keep builds reproducible and offline-friendly.
