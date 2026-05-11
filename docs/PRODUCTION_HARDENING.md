# Production Hardening Runbook

Steps to harden the Samwise stack before opening it to real Revenue-bound
data flows. Each item is independent and can be done in any order. None of
them block the demo - these are the "before real subcontractors with real
PPS numbers sign in" checklist.

---

## 1. ALLOWED_ORIGINS env var on the Worker

The worker has a hardcoded fallback list of allowed CORS origins
(`samwisebc.com`, `wickthethird.github.io`, `localhost:5173`). For production
hygiene, set the explicit allowlist as a Worker variable so the fallback
never matters and you can rotate it without redeploying:

1. Cloudflare → Workers → `nexora-api` → Settings → Variables and Secrets
2. Add (Plaintext, not Secret):
   - **Name:** `ALLOWED_ORIGINS`
   - **Value:** `https://samwisebc.com,https://www.samwisebc.com,https://wickthethird.github.io`
3. Save and deploy

The worker's `parseAllowedOrigins(env)` already reads this env var first and
falls back to the hardcoded list if missing. Once set, you can drop dev
origins (like `localhost`) for stricter production posture.

To verify: any preflight from an origin not in the list returns a CORS
failure. Test with:
```bash
curl -i -H "Origin: https://evil.example.com" \
  -X OPTIONS https://nexora-api.bumbufilip22.workers.dev/auth/me
```

The response should have `access-control-allow-origin: <empty>` (or be
omitted entirely), preventing the browser from completing the request.

---

## 2. Cloudflare Rate Limiting on the Worker

Add a free-tier rate-limiting rule to soften DOS attempts. The worker has
its own per-email login rate limiter, but this catches everything else
(brute-force credential stuffing, scraping, accidental loops).

1. Cloudflare → Workers → `nexora-api` → Settings → Triggers (or Routes for
   Workers Routes-style deployments)
2. Add a Custom Domain or Route if not already present:
   - `nexora-api.bumbufilip22.workers.dev/*` (already set)
3. Cloudflare Dashboard → Security → WAF → Rate limiting rules
4. Create rule:
   - **Rule name:** `samwise-api-throttle`
   - **Field:** IP Source Address
   - **Operator:** rate exceeds
   - **Value:** `100 requests per 10 seconds`
   - **Action:** Block for 60 seconds
   - **Scope:** apply to `nexora-api.bumbufilip22.workers.dev` (or your custom
     API domain)
5. Save

Free plan allows one rate-limiting rule. If you need multiple (e.g. stricter
on `/auth/login`), upgrade to Pro (€20/mo) which gives 5 rules.

Recommended additional rules on Pro:
- `/auth/login` - 5 req/min per IP, block 5 min (defends credential stuffing)
- `/auth/request-password-reset` - 3 req/min per IP (defends spray)
- `/admin/bulk-advice/import` - 5 req/min per IP (defends CSV-based abuse)

---

## 3. D1 Backup strategy

D1 has built-in **Time Travel** - automatic point-in-time restore for the
last 30 days. This covers most accidental-delete scenarios. Verify it's on:

```bash
npx wrangler d1 info nexora --remote
```

Look for `version` and confirm Time Travel is "On" in the Cloudflare D1
dashboard (Database → Settings).

**For paranoia** (recommended when real PPS numbers are in the DB), schedule
a weekly logical backup to R2:

1. Create a Cloudflare Cron Trigger on the worker:
   - Schedule: `0 3 * * 0` (Sundays 03:00 UTC)
   - Add a `scheduled` handler in `worker.js` (template below)
2. Add an R2 bucket binding `BACKUP_BUCKET` pointing at a new private R2
   bucket `samwise-backups`
3. The handler does:

```js
async scheduled(event, env, ctx) {
  // Pull row counts + a snapshot of every key table.
  const tables = ["users","subcontractors","primaries","payment_records",
                  "primary_invoices","primary_submissions",
                  "contracts","timesheets","app_settings"];
  const dump = { exportedAt: Date.now(), tables: {} };
  for (const t of tables) {
    const r = await env.DB.prepare(`SELECT * FROM ${t}`).all();
    dump.tables[t] = r.results || [];
  }
  const key = `backup-${new Date().toISOString().slice(0,10)}.json`;
  await env.BACKUP_BUCKET.put(key, JSON.stringify(dump),
    { httpMetadata: { contentType: "application/json" } });
}
```

R2 storage cost: ~€0.015/GB/month. A typical 6-month backup retention with
~1MB dumps = €0.0001/month. Free tier (10GB) covers years.

**Restore**: from the R2 bucket pull the JSON for the date you want, then
run a one-off worker script that INSERTs each row back. (Manual; needed
only in catastrophic loss scenarios.)

---

## 4. Privacy Notice + Terms of Service legal review

The current `/legal/privacy` and `/legal/terms` pages are comprehensive
templates that cover:
- GDPR Articles 6, 13–22
- Irish Data Protection Act 2018 references
- 6-year retention for tax records (Statute of Limitations 1957)
- RCT regime + VAT obligations
- Cookie disclosure (single strictly-necessary cookie)
- DPC contact details
- 3-tier role visibility (admin / principal / subcontractor)
- Cloudflare + Brevo as named processors

**Before going live**, have them reviewed by a solicitor qualified in Irish
data protection and contract law. Specifically:
- Have your solicitor add the company registered office address + CRO
  number to both pages
- Confirm the data controller email (currently `hello@bc-construction.ie`)
- Decide if you want to nominate a Data Protection Officer (not strictly
  required for SME but reassuring for principals onboarding)
- Adjust the retention periods if your accountant advises differently
  (six years is the default safe retention)

**Incremental update process**: when the solicitor's edits land, bump
`PRIVACY_VERSION` and `TERMS_VERSION` constants in the respective files -
the existing consent gate detects version mismatches and prompts every
user to re-accept on next sign-in (already wired up).

---

## 5. Other readiness items (nice-to-haves)

- **Brevo domain reputation**: Send a few emails to `bumbufilip22@gmail.com`
  and verify they land in inbox, not spam. If they spam, set up DKIM/SPF
  alignment in Brevo + add a DMARC record on `samwisebc.com`.
- **Domain SSL grade**: Run `https://www.ssllabs.com/ssltest/analyze.html?d=samwisebc.com`
  - should be A+ via Cloudflare. If not, check your origin certs.
- **GitHub Actions secrets rotation**: rotate `CLOUDFLARE_API_TOKEN`
  every 90 days.
- **Worker secret rotation**: rotate `BREVO_API_KEY` every 6 months or on
  any suspected breach. New key in Brevo, paste into Worker, redeploy.
- **GDPR request response window**: set a calendar reminder to action any
  GDPR access/erasure request within 30 days (Article 12(3)).
- **Insurance**: cyber liability insurance (~€500–1,000/yr for SME) is
  prudent now that you're handling real PPS numbers and bank details.

---

## 6. Smoke test the hardened stack

After applying items 1, 2, 3:

```bash
# CORS test (should fail)
curl -i -H "Origin: https://evil.example.com" \
  -X OPTIONS https://nexora-api.bumbufilip22.workers.dev/auth/me

# Rate limit test (should start failing after 100 quick requests)
for i in $(seq 1 120); do
  curl -s -o /dev/null -w "%{http_code} " \
    https://nexora-api.bumbufilip22.workers.dev/health
done
echo

# Backup test (manually trigger the scheduled handler from Cloudflare
# dashboard "Run scheduled" button, then list R2 contents)
npx wrangler r2 object list samwise-backups
```

If those all behave correctly, you're production-ready for real users.
