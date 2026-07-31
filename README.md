<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d41516de-5ce9-467e-8d3f-3c7ac9de5dab

## Exercises

Ten mini-games, each targeting a different visual skill. All are designed for
monocular (patched) pleoptic training as well as normal play, and support an
optional red/cyan anaglyph mode for dichoptic training:

| Game | Visual skill |
|------|--------------|
| Rocket Tracker | Smooth pursuit (free-flying target) |
| Foggy Flight | Contrast sensitivity |
| Traffic Jam | Visual discrimination (odd one out) |
| Speedway Saccades | Saccadic eye movements |
| Peripheral Patrol | Peripheral awareness |
| Foggy Spotter | Contrast sensitivity (grid search) |
| Checkpoint | Discrimination + reaction time |
| Metro Tracker | Smooth pursuit along a metro line with wide horizontal sweeps |
| Station Hunt | Fine acuity under crowding — find the station letter among look-alikes |
| Line Navigator | Eyes-only visual tracing of tangled metro lines to their terminals |

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
