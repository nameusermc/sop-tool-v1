# WithoutMe — Incident Response Playbook

**For:** Quick reference when something goes wrong  
**Last updated:** March 1, 2026

---

## Site Down (withoutme.app unreachable)

**How you'll know:** UptimeRobot email alert, or users report it.

1. Check UptimeRobot status page: https://stats.uptimerobot.com/PrlbCkR2Tz
2. Check Vercel status: https://www.vercelstatus.com
3. Check Vercel Dashboard → Deployments — did a recent deploy break something?
   - If yes: click the previous working deployment → "Promote to Production" (instant rollback)
4. Check Vercel Dashboard → Logs for errors
5. If Vercel itself is down, nothing to do but wait — it's their infrastructure
6. If it's a code issue, revert the last commit: `git revert HEAD && git push`

**Comms:** If down for 30+ minutes, post on social (@withoutmeapp) that you're aware and working on it.

---

## Billing / Paddle Issues

**Checkout not working:**
1. Check Paddle status: https://status.paddle.com
2. Check Vercel Logs for `/api/paddle-webhook` errors
3. Verify Paddle credentials in Vercel env vars haven't expired
4. Test checkout in incognito browser

**User says they paid but no Pro access:**
1. Check Paddle vendor dashboard → Transactions → find by email
2. Check Supabase → `subscriptions` table → search by email
3. If payment exists in Paddle but not in Supabase, the webhook failed
   - Manually insert a row in `subscriptions` with their email, status=active, paddle_subscription_id
4. Reply to user confirming it's fixed

**User wants a refund:**
1. Go to Paddle vendor dashboard → find the transaction
2. Issue refund through Paddle (Paddle handles the actual money movement)
3. The webhook will update `subscriptions` table automatically
4. Confirm with user

---

## AI Endpoint Issues (API costs spiking)

**How you'll know:** Anthropic dashboard shows unexpected usage, or Vercel logs show high volume.

1. Check Anthropic Console: https://console.anthropic.com → Usage
2. Check Vercel Logs: filter for `[ai] Usage:` to see who's making calls
3. If one user is abusing it:
   - Temporarily disable their subscription in Supabase (`status` = 'paused')
   - Contact them via email
4. If it's a bot/attack:
   - Add the user's email to a blocklist in the ai.js code
   - Redeploy immediately
5. Nuclear option: temporarily set `ANTHROPIC_API_KEY` to empty string in Vercel env vars → all AI calls fail gracefully

---

## Data Breach (suspected unauthorized access)

**How you'll know:** Sentry alert for unusual errors, user report, Supabase audit logs showing unexpected access.

**Within first hour:**
1. Assess scope: what data could be affected?
2. Check Supabase Dashboard → Auth → Users for suspicious new accounts
3. Check Supabase Dashboard → SQL Editor → recent queries
4. Check Vercel Logs for unusual API patterns
5. If credentials are compromised:
   - Rotate ALL env vars in Vercel (Supabase service key, Paddle keys, Anthropic key, etc.)
   - Rotate Supabase anon key and update index.html
   - Redeploy

**Within 72 hours:**
1. Email affected users explaining what happened, what data was affected, and what you're doing
2. This is required by GDPR (72 hours) and good practice regardless
3. See privacy policy Section 13 (Data Breach Notification)

**Template:**
> Subject: Security Notice from WithoutMe
>
> We're writing to inform you of a security incident that may have affected your WithoutMe account. [Describe what happened and what data was potentially affected.]
>
> What we've done: [Steps taken to contain and fix]
> What you should do: [Change password, etc.]
>
> We take the security of your data seriously and apologize for this incident. If you have questions, contact support@withoutme.app.

---

## Supabase Issues

**Database unreachable:**
1. Check Supabase status: https://status.supabase.com
2. The app is offline-first — users can still create/edit SOPs locally
3. Cloud sync will resume when Supabase is back
4. If prolonged, post on social that cloud sync is temporarily unavailable

**Running out of storage (free tier):**
1. Check Supabase Dashboard → Settings → Usage
2. Free tier: 500MB database, 1GB file storage
3. If approaching limits, upgrade to Supabase Pro ($25/mo)

---

## Angry Customer / Bad Review

1. Respond within 24 hours, empathetically
2. If their complaint is valid, fix the issue and follow up
3. If they want a refund, give it — $39 is not worth a bad reputation
4. If they found a bug, thank them and fix it
5. Never argue publicly

---

## Sentry Alert (Frontend JS Error)

**How you'll know:** Email from Sentry.

1. Check Sentry Dashboard: https://sentry.io → Issues
2. Read the stack trace — is it a real bug or a browser extension conflict?
3. If it's a real bug in your code:
   - Reproduce it locally
   - Fix and deploy
4. If it's a browser extension or bot: mark as ignored in Sentry
5. Common false positives: ad blockers breaking GA4, old browsers failing on modern JS

---

## Quick Reference — Service Dashboards

| Service | Dashboard |
|---------|-----------|
| Vercel (hosting) | https://vercel.com/dashboard |
| Supabase (database) | https://supabase.com/dashboard |
| Paddle (billing) | https://vendors.paddle.com |
| Anthropic (AI) | https://console.anthropic.com |
| UptimeRobot | https://dashboard.uptimerobot.com |
| Sentry | https://sentry.io |
| GA4 | https://analytics.google.com |
| Google Search Console | https://search.google.com/search-console |
| Postmark (email) | https://account.postmarkapp.com |
