# Nexora

Subcontractor onboarding and operations portal.

## Local development

Requires Node 20+.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

Pushes to `main` are built and deployed to GitHub Pages by the workflow in
`.github/workflows/deploy.yml`.

To use a custom domain, add a `public/CNAME` file containing the domain name —
the workflow detects it and adjusts the build base path.

Runtime configuration (such as the API base URL) lives in `public/config.js`
and is served as-is. Edit and redeploy to swap backends without rebuilding the
SPA.
