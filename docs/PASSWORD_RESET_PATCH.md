# Password Reset — Worker Patch (Brevo)

Three pieces to apply by hand:

1. Run the SQL block once in the D1 console.
2. Set three Worker secrets (`BREVO_API_KEY`, `EMAIL_FROM`, `APP_URL`).
3. Paste the JS block into `worker.js` and wire the two routes.

Frontend is already deployed via the SPA build and hits `POST /auth/request-password-reset` and `POST /auth/reset-password`.

---

## 1) D1 SQL (run once)

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  consumed_at  INTEGER,
  created_at   INTEGER NOT NULL,
  ip_address   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);
```

---

## 2) Worker secrets (Cloudflare → Worker → Settings → Variables)

| Name              | Value                                            |
| ----------------- | ------------------------------------------------ |
| `BREVO_API_KEY`   | Brevo dashboard → SMTP & API → API Keys → create |
| `EMAIL_FROM`      | `Samwise <noreply@samwisebc.com>`                |
| `APP_URL`         | `https://samwisebc.com`                          |

`EMAIL_FROM` must use a domain you've verified in Brevo. Until you finish DNS (DKIM + SPF + DMARC), Brevo will reject sends from that address — use the Brevo sandbox sender for first smoke tests.

---

## 3) JS to add to `worker.js`

### 3a — Constants (near the top, alongside `RCT_RATES`, `TIMESHEET_STATUSES`)

```js
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_RATE_LIMIT_PER_HOUR = 5;        // per email + per IP
```

### 3b — `sendEmail` helper (Brevo Transactional)

```js
// Send a transactional email via Brevo. Returns true on success, false on
// failure (we never throw — email is best-effort, never blocks the API).
async function sendEmail(env, { to, subject, html, text }) {
  if (!env.BREVO_API_KEY) {
    console.warn("BREVO_API_KEY not set, skipping email to", to);
    return false;
  }
  const fromHeader = env.EMAIL_FROM || "Samwise <noreply@samwisebc.com>";
  // Parse "Name <addr>" form into Brevo's structured sender object.
  const m = /^(.*?)\s*<(.+)>$/.exec(fromHeader);
  const sender = m
    ? { name: m[1].trim() || "Samwise", email: m[2].trim() }
    : { name: "Samwise", email: fromHeader.trim() };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Brevo send failed", res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Brevo send threw", e?.message || e);
    return false;
  }
}

// Generate a URL-safe random token. 32 bytes = 256 bits of entropy.
function generateResetToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
```

### 3c — Request-reset handler

```js
// POST /auth/request-password-reset  { email }
// Always returns 200 with { ok: true } regardless of whether the email exists,
// to prevent account enumeration. Sends an email out-of-band on success.
async function handleRequestPasswordReset(req, env) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonOk({ ok: true }); // Silent — don't leak validation either.
  }

  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const since = now - 60 * 60 * 1000;

  // Rate limit per IP (cheap defence against spray).
  const ipCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM password_reset_tokens WHERE ip_address = ? AND created_at > ?`,
  ).bind(ip, since).first();
  if ((ipCount?.n || 0) >= RESET_RATE_LIMIT_PER_HOUR * 4) {
    return jsonOk({ ok: true }); // silently drop
  }

  // Look up user. If none, still return ok.
  const user = await env.DB.prepare(
    `SELECT id, email FROM users WHERE email = ? LIMIT 1`,
  ).bind(email).first();
  if (!user) return jsonOk({ ok: true });

  // Per-user rate limit.
  const userCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ? AND created_at > ?`,
  ).bind(user.id, since).first();
  if ((userCount?.n || 0) >= RESET_RATE_LIMIT_PER_HOUR) {
    return jsonOk({ ok: true });
  }

  const token = generateResetToken();
  const expiresAt = now + RESET_TOKEN_TTL_MS;
  await env.DB.prepare(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(token, user.id, expiresAt, now, ip).run();

  const appUrl = (env.APP_URL || "https://samwisebc.com").replace(/\/$/, "");
  const link = `${appUrl}/#/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your Samwise password";
  const text =
`Hi,

Someone (hopefully you) requested a password reset for your Samwise account.

Reset your password here (link expires in 1 hour):
${link}

If you didn't request this, you can safely ignore this email — your password
won't change.

— Samwise`;
  const html = `
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin: 0 0 12px;">Reset your Samwise password</h2>
  <p>Someone (hopefully you) requested a password reset for your account.</p>
  <p style="margin: 24px 0;">
    <a href="${link}" style="background:#111; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; display:inline-block;">Reset password</a>
  </p>
  <p style="font-size: 13px; color:#555;">Or copy this link into your browser:<br><code style="word-break:break-all;">${link}</code></p>
  <p style="font-size: 13px; color:#555;">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore the email.</p>
  <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
  <p style="font-size: 12px; color:#888;">Samwise · bc</p>
</div>`;

  // Fire and forget — don't make the user wait for SMTP, and don't reveal
  // success/failure of email delivery in the response.
  ctx_waitUntil(req, sendEmail(env, { to: email, subject, html, text }));

  return jsonOk({ ok: true });
}
```

> Note: replace `ctx_waitUntil(req, ...)` with however your worker passes
> `ctx` into handlers. If your handler signature is `(req, env, ctx)`, just
> use `ctx.waitUntil(sendEmail(...))`. If you don't have ctx, `await` the
> send instead — adds ~300 ms to the response.

### 3d — Reset-password handler

```js
// POST /auth/reset-password  { token, newPassword }
async function handleResetPassword(req, env) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const newPassword = String(body.newPassword || "");
  if (!token) return jsonError("INVALID_TOKEN", "Missing token", 400);
  if (newPassword.length < 12) {
    return jsonError("WEAK_PASSWORD", "Password must be at least 12 characters", 400);
  }

  const row = await env.DB.prepare(
    `SELECT token, user_id, expires_at, consumed_at FROM password_reset_tokens WHERE token = ? LIMIT 1`,
  ).bind(token).first();
  if (!row) return jsonError("INVALID_TOKEN", "Invalid or already used", 400);
  if (row.consumed_at) return jsonError("INVALID_TOKEN", "Already used", 400);
  if (row.expires_at < Date.now()) {
    return jsonError("TOKEN_EXPIRED", "Reset link expired", 400);
  }

  const newHash = await hashPassword(newPassword);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
    ).bind(newHash, now, row.user_id),
    env.DB.prepare(
      `UPDATE password_reset_tokens SET consumed_at = ? WHERE token = ?`,
    ).bind(now, token),
    // Kill all sessions for this user — force fresh login everywhere.
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(row.user_id),
  ]);

  await auditLog(env, {
    actorUserId: row.user_id,
    action: "password.reset",
    targetType: "user",
    targetId: row.user_id,
    metadata: { method: "email-token" },
  });

  return jsonOk({ ok: true });
}
```

### 3e — Route wiring (in your main router)

Add these BEFORE the auth-required dispatch:

```js
if (req.method === "POST" && url.pathname === "/auth/request-password-reset") {
  return handleRequestPasswordReset(req, env);
}
if (req.method === "POST" && url.pathname === "/auth/reset-password") {
  return handleResetPassword(req, env);
}
```

---

## Smoke test

```bash
# Should always return {ok:true} regardless of whether email exists
curl -X POST https://nexora-api.bumbufilip22.workers.dev/auth/request-password-reset \
  -H 'content-type: application/json' \
  -d '{"email":"you@samwisebc.com"}'

# After receiving the email, copy the token from the link:
curl -X POST https://nexora-api.bumbufilip22.workers.dev/auth/reset-password \
  -H 'content-type: application/json' \
  -d '{"token":"PASTE_TOKEN_HERE","newPassword":"a-real-strong-password"}'
```

Then sign in with the new password — old sessions should be gone.
