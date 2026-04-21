# Nexora — subcontractor portal

A two-portal web app (subcontractor self-service + admin operations) for
contractor onboarding, contract signing, document review, questionnaire,
payments, and change requests.

- Frontend: Vite + React + TypeScript + TailwindCSS, deployed to **GitHub Pages**.
- Backend: Cloudflare Worker + D1 + R2 (code lives in the `nexora-api` Worker
  on Cloudflare; this repo contains only the frontend).
- Routing: `HashRouter` — works on any GitHub Pages path or a custom domain
  with no server-side routing.
- Domain-friendly: the API URL is read from a runtime `config.js`, not baked
  into the build, so the same artifact can be redeployed to a new domain without
  rebuilding.

## Running locally

```bash
npm install
npm run dev
```

Opens the dev server at `http://localhost:5173/` (default Vite port).

Edit `public/config.js` to point `apiUrl` at a different backend:

```js
window.__NEXORA_CONFIG__ = {
  apiUrl: "https://nexora-api.bumbufilip22.workers.dev",
  brand: "Nexora",
};
```

> The Worker must whitelist your frontend origin via the `ALLOWED_ORIGINS`
> environment variable in the Cloudflare dashboard (comma-separated origins,
> e.g. `https://your-domain.com,http://localhost:5173`).

## Deploying to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys
on every push to `main`.

### First-time setup

1. Push this repo to GitHub (`git push -u origin main`).
2. In the repo settings → **Pages** → set **Source** to **GitHub Actions**.
3. Wait for the first workflow run; the site will appear at
   `https://<your-user>.github.io/<repo-name>/`.

### Changing the domain

The build script sets `VITE_BASE` automatically:

- No custom domain → `VITE_BASE=/nexora/` (matches the GitHub Pages project URL)
- Custom domain → `VITE_BASE=/` (apex)

To use a custom domain:

1. Create `public/CNAME` containing a single line with your domain, e.g.:
   ```
   nexora.example.com
   ```
2. Point your DNS at GitHub Pages:
   - `A` records at apex: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Or `CNAME` for a subdomain: `<your-user>.github.io`
3. Push. The workflow detects the `CNAME` file, builds with `VITE_BASE=/`, and
   deploys the site to your domain.
4. Update `public/config.js` → `apiUrl` if your API moves too, and whitelist
   the new frontend origin on the Worker (see CORS patch).

### Changing the API URL later without rebuilding

Since `config.js` is served as a static asset, you can ship a new backend without
triggering a build: just edit `public/config.js`, commit, and push. The next
deploy overwrites only that file.

## Project structure

```
src/
  components/
    ui/              buttons, inputs, badges, modal, toasts, logo
    layout/          portal shell (sidebar + mobile nav)
  lib/
    api.ts           typed fetch client (reads window.__NEXORA_CONFIG__)
    auth.tsx         AuthProvider + useAuth hook
    format.ts        date/money/initials helpers
    types.ts         shared types (mirror worker contracts)
  pages/
    Login.tsx
    ChangePassword.tsx
    subcontractor/   7 pages: Home, ProfileEdit, Contract, Documents,
                     Questionnaire, Payments, Support
    admin/           5 pages: Dashboard, Subcontractors, SubcontractorDetail,
                     Templates, ChangeRequests
public/
  config.js          runtime config (edit after deploy to change API URL)
  404.html           SPA fallback (keeps deep links working on GH Pages)
.github/workflows/
  deploy.yml         build + deploy to GitHub Pages
```

## Security posture (backend)

Already implemented on the Worker side and assumed by this frontend:

- Session cookies: `HttpOnly; Secure; SameSite=Lax`
- PBKDF2 password hashing
- AES-GCM field encryption for PPS / account number / sort code / IBAN
- Rate-limited + timing-safe login
- Forced password change on first login & admin reset
- Admin audit log
- R2 never publicly accessible — every download goes through the Worker

See the parent Worker project for details.
