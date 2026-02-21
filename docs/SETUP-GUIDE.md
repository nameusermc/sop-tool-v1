# SOP Tool — Complete Setup Guide

## Overview

This guide covers the complete setup of the SOP Tool backend and frontend integration in one pass.

**What you'll set up:**
- Supabase project (database + auth)
- Vercel serverless backend
- Frontend integration with offline support
- Payment stubs for future Paddle integration

**Time required:** ~30 minutes

---

## Step 1: Download and Extract Files

1. Download `sop-backend-files.zip`
2. Extract it — you'll get a `sop-backend-files/` folder

---

## Step 2: Merge Files into Your Working Folder

Your current folder structure:
```
your-sop-tool/
├── index.html
├── app.js
├── modules/
│   ├── dashboard.js
│   ├── sop-create.js
│   └── checklist.js
```

**Copy these folders/files from `sop-backend-files/` into your working folder:**

| Copy This | Action |
|-----------|--------|
| `api/` folder | ADD (new) |
| `lib/` folder | ADD (new) |
| `index.html` | REPLACE existing |
| `app.js` | REPLACE existing |
| `package.json` | ADD (new) |
| `vercel.json` | ADD (new) |
| `schema.sql` | ADD (new) |
| `.env.example` | ADD (new) |
| `.gitignore` | ADD (new) |
| `BACKEND.md` | ADD (optional, docs) |
| `FRONTEND-INTEGRATION.md` | ADD (optional, docs) |

**Do NOT overwrite:**
- `modules/` folder — keep your existing files

**After merging, your folder should look like:**
```
your-sop-tool/
├── index.html              ← REPLACED
├── app.js                  ← REPLACED
├── modules/                ← UNCHANGED
│   ├── dashboard.js
│   ├── sop-create.js
│   └── checklist.js
├── api/                    ← NEW
│   ├── auth/
│   │   ├── register.js
│   │   ├── login.js
│   │   ├── logout.js
│   │   └── session.js
│   ├── sops/
│   │   ├── index.js
│   │   └── [id].js
│   ├── checklists/
│   │   ├── index.js
│   │   └── [id].js
│   ├── folders/
│   │   ├── index.js
│   │   └── [id].js
│   └── user/
│       └── sync.js
├── lib/                    ← NEW
│   ├── storage-adapter.js
│   ├── module-integration.js
│   ├── payments.js
│   ├── api-client.js
│   ├── data-service.js
│   ├── auth.js
│   ├── response.js
│   └── supabase.js
├── package.json            ← NEW
├── vercel.json             ← NEW
├── schema.sql              ← NEW
├── .env.example            ← NEW
└── .gitignore              ← NEW
```

---

## Step 3: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **New Project**
3. Fill in:
   - **Name:** `sop-tool` (or whatever you like)
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose closest to your users
4. Click **Create new project** and wait ~2 minutes

---

## Step 4: Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Open `schema.sql` from your project folder
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" — this is correct

---

## Step 5: Get Supabase API Keys

1. In Supabase dashboard, go to **Settings** → **API** (left sidebar)
2. Note these values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (under "Project API keys")
   - **service_role** key (click "Reveal" — keep this secret!)

---

## Step 6: Configure Environment Variables

1. In your project folder, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your Supabase values:
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   APP_URL=http://localhost:3000
   ```

---

## Step 7: Install Dependencies

In your project folder, run:

```bash
npm install
```

This installs:
- `@supabase/supabase-js` — Supabase client
- `vercel` — Local dev server (devDependency)

---

## Step 8: Test Locally

Start the local dev server:

```bash
npm run dev
```

Or if that doesn't work:

```bash
npx vercel dev
```

The first time, Vercel CLI will ask you to:
1. Log in to Vercel (creates account if needed)
2. Link to a project (choose "Create new")

Once running, open [http://localhost:3000](http://localhost:3000)

**You should see:**
- Auth screen (for new users with no local data)
- OR Dashboard (if you have existing localStorage data)

---

## Step 9: Test the Integration

### Test 1: Local-Only Mode
1. Click "Continue without account"
2. Create an SOP
3. Refresh the page — SOP should persist

### Test 2: Registration
1. Click "Create Account" tab
2. Register with email/password
3. If you had local data, you'll see a sync prompt
4. Dashboard loads with your data

### Test 3: Offline Support
1. Open DevTools → Network → check "Offline"
2. Make changes (create/edit SOPs)
3. See "📴 Offline" indicator in bottom-left
4. Uncheck "Offline"
5. Changes sync automatically

---

## Step 10: Deploy to Vercel

When ready to deploy:

```bash
npm run deploy
```

Or:

```bash
npx vercel --prod
```

**After deploying:**
1. Go to your Vercel dashboard
2. Select your project → Settings → Environment Variables
3. Add the same variables from `.env.local`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

---

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
Run `npm install` again.

### Auth not working
- Check Supabase dashboard → Authentication → Settings
- Ensure "Enable Email Signup" is ON
- Check your `.env.local` values are correct

### Database errors
- Re-run `schema.sql` in Supabase SQL Editor
- Check for any error messages

### "StorageAdapter not found"
- Ensure `lib/storage-adapter.js` exists
- Check script order in `index.html`

### Changes not syncing
- Open DevTools Console, look for errors
- Check `StorageAdapter.Auth.isAuthenticated()` returns `true`
- Check `StorageAdapter.isOnline()` returns `true`

---

## File Reference

### Files You Replaced
| File | What Changed |
|------|--------------|
| `index.html` | Added new script tags in correct order |
| `app.js` | Added auth flow, sync screen, user indicator |

### New Backend Files (`api/`)
| File | Purpose |
|------|---------|
| `auth/register.js` | POST /api/auth/register |
| `auth/login.js` | POST /api/auth/login |
| `auth/logout.js` | POST /api/auth/logout |
| `auth/session.js` | GET /api/auth/session |
| `sops/index.js` | GET/POST /api/sops |
| `sops/[id].js` | GET/PUT/DELETE /api/sops/:id |
| `checklists/index.js` | GET/POST /api/checklists |
| `checklists/[id].js` | GET/PUT/DELETE /api/checklists/:id |
| `folders/index.js` | GET/POST /api/folders |
| `folders/[id].js` | PUT/DELETE /api/folders/:id |
| `user/sync.js` | POST /api/user/sync (localStorage migration) |

### New Frontend Files (`lib/`)
| File | Purpose |
|------|---------|
| `storage-adapter.js` | Abstracts localStorage ↔ API calls with offline queue |
| `module-integration.js` | Patches Dashboard/SOPCreate/Checklist to use StorageAdapter |
| `payments.js` | Paddle stubs (ready for future integration) |
| `api-client.js` | Low-level API fetch wrapper |
| `supabase.js` | Supabase client initialization |
| `auth.js` | Backend auth middleware |
| `response.js` | API response helpers |

---

## Future: Paddle Integration

When ready to add payments, edit `lib/payments.js`:

1. Add Paddle.js to `index.html`:
   ```html
   <script src="https://cdn.paddle.com/paddle/paddle.js"></script>
   ```

2. Update `checkout()` function in `payments.js`:
   ```javascript
   export async function checkout(planId) {
       return new Promise((resolve) => {
           Paddle.Checkout.open({
               product: planId,
               successCallback: () => resolve({ success: true }),
               closeCallback: () => resolve({ success: false })
           });
       });
   }
   ```

3. Create `/api/payments/webhook.js` to handle Paddle webhooks

---

## Summary

After completing this guide, you have:

✅ Supabase database with user data  
✅ Email/password authentication  
✅ Cloud sync across devices  
✅ Offline support with automatic sync  
✅ localStorage fallback for non-authenticated users  
✅ Completed checklist immutability  
✅ Payment stubs ready for Paddle  

Your existing Phase 1 UX (empty states, trust copy, visual polish) remains fully intact.
