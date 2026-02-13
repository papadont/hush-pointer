# HUSH·PAINTER

HUSH·PAINTER is a browser-based drawing app built with React + TypeScript + Vite.

## Features

- Brush and eraser tools
- Adjustable stroke size and color
- Eraser rendering via `destination-out` on canvas

## Local Development

```bash
npm install
npm run dev
```

### Available Scripts

- `npm run dev`: start local dev server
- `npm run build`: type-check and build production assets
- `npm run lint`: run ESLint
- `npm run preview`: preview production build locally

## Deploy Policy

- Production deploy is handled by GitHub Actions.
- Push to `main` to deploy to GitHub Pages.
- Do not use local `gh-pages` manual deploy.

Workflow file:

- `.github/workflows/deploy-pages.yml`

## Current Version

- `v1.7`
