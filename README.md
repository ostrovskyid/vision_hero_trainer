<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d41516de-5ce9-467e-8d3f-3c7ac9de5dab

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

Pushes to `main` build the app and publish it via
[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

One-time setup: in **Settings → Pages**, set **Source** to **GitHub Actions**.

The site is served from `https://<user>.github.io/vision_hero_trainer/`, so
`vite.config.ts` sets `base` to `/vision_hero_trainer/` for production builds.
Renaming the repository means updating that value.
