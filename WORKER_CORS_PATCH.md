# Worker CORS additions (Phase 5)

The frontend will live on a different origin (`https://wickthethird.github.io` or
your custom domain), so the Worker must:

1. Whitelist the frontend origin
2. Reflect it in `Access-Control-Allow-Origin`
3. Send `Access-Control-Allow-Credentials: true` (so the session cookie is
   accepted cross-origin)
4. Handle `OPTIONS` preflights

Because credentialed requests can't use `*`, we need an explicit origin
allowlist. The easiest way is an environment variable.

## Step 1 — add an allowlist env var in the Worker dashboard

Settings → Variables → Add variable (plaintext, not secret):

- Name: `ALLOWED_ORIGINS`
- Value: comma-separated origins, e.g.
  `https://wickthethird.github.io,https://nexora.example.com,http://localhost:5173`

`http://localhost:5173` is optional but handy while developing the frontend.

## Step 2 — add this helper near the top of `worker.js`

Paste anywhere near the other small helpers (e.g. just after `const clientIp`):

```js
function parseAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function pickOrigin(req, env) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  return parseAllowedOrigins(env).includes(origin) ? origin : null;
}
function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
}
```

## Step 3 — update the `export default { fetch }` block

Replace the existing `fetch` handler with this version, which:

- Short-circuits preflight `OPTIONS` requests with CORS headers.
- Appends CORS headers to every normal response.

```js
export default {
  async fetch(request, env) {
    const origin = pickOrigin(request, env);

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    let res;
    try {
      res = await route(request.method, new URL(request.url).pathname, request, env);
    } catch (e) {
      console.error("unhandled error", e);
      res = err("INTERNAL", "internal error", 500);
    }

    // Clone response and add CORS headers.
    if (origin) {
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
      res = new Response(res.body, { status: res.status, headers });
    }
    return res;
  },
};
```

## Step 4 — redeploy

That's all. The SPA can now call the Worker with `credentials: "include"` from
any whitelisted origin, and the session cookie will round-trip correctly.

## Sanity check

From a browser on `https://wickthethird.github.io`, opening DevTools and running:

```js
fetch("https://nexora-api.bumbufilip22.workers.dev/health", { credentials: "include" })
  .then(r => r.json()).then(console.log);
```

should return `{ ok: true, data: { ... } }` and no CORS error.
