# SOP Tool Backend — Phase 2

## Overview

Minimal serverless backend for authentication, user-specific persistence, and future payments.

**Stack:**
- **Runtime:** Vercel Serverless Functions (Node.js 20)
- **Auth:** Supabase Auth (email/password)
- **Database:** Supabase PostgreSQL
- **Payments:** Stripe (future integration prepared)

## Project Structure

```
sop-tool-v1/
├── api/                          # Vercel serverless functions
│   ├── auth/
│   │   ├── register.js           # POST /api/auth/register
│   │   ├── login.js              # POST /api/auth/login
│   │   ├── logout.js             # POST /api/auth/logout
│   │   └── session.js            # GET  /api/auth/session
│   ├── sops/
│   │   ├── index.js              # GET /api/sops (list), POST /api/sops (create)
│   │   └── [id].js               # GET/PUT/DELETE /api/sops/:id
│   ├── checklists/
│   │   ├── index.js              # GET /api/checklists, POST /api/checklists
│   │   └── [id].js               # GET/PUT/DELETE /api/checklists/:id
│   ├── folders/
│   │   ├── index.js              # GET /api/folders, POST /api/folders
│   │   └── [id].js               # PUT/DELETE /api/folders/:id
│   └── user/
│       └── sync.js               # POST /api/user/sync (bulk import from localStorage)
├── lib/
│   ├── supabase.js               # Supabase client
│   ├── auth.js                   # Auth middleware/helpers
│   └── response.js               # API response helpers
├── schema.sql                    # Database schema
├── vercel.json                   # Vercel configuration
├── package.json                  # Dependencies
├── .env.example                  # Environment variables template
└── index.html                    # Existing frontend (unchanged)
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API
3. Run the SQL from `schema.sql` in the Supabase SQL Editor

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # For admin operations
JWT_SECRET=your-jwt-secret-min-32-chars
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

Or connect your GitHub repo to Vercel for automatic deployments.

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login, returns session token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/session` | Check current session |

### SOPs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sops` | List user's SOPs |
| POST | `/api/sops` | Create new SOP |
| GET | `/api/sops/:id` | Get single SOP |
| PUT | `/api/sops/:id` | Update SOP |
| DELETE | `/api/sops/:id` | Delete SOP |

### Checklists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/checklists` | List user's checklists |
| POST | `/api/checklists` | Create new checklist |
| GET | `/api/checklists/:id` | Get single checklist |
| PUT | `/api/checklists/:id` | Update checklist |
| DELETE | `/api/checklists/:id` | Delete checklist |

### Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | List user's folders |
| POST | `/api/folders` | Create new folder |
| PUT | `/api/folders/:id` | Update folder |
| DELETE | `/api/folders/:id` | Delete folder |

### Data Migration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/sync` | Bulk import from localStorage |

## Frontend Integration

### Minimal Changes Required

The frontend needs a thin API layer to replace localStorage calls. Create `lib/api-client.js`:

```javascript
// Replace localStorage calls with API calls
// Example: this._saveSops() becomes apiClient.saveSops(sops)
```

### Auth Flow

1. On app load, check `/api/auth/session`
2. If no session, show login/register modal
3. On successful auth, load user's SOPs from `/api/sops`
4. All CRUD operations go through API instead of localStorage

### Migration Path

For existing users with localStorage data:
1. After first login, detect localStorage data
2. Call `/api/user/sync` to import all data
3. Clear localStorage after successful import
4. Show confirmation to user

## Security Notes

- All API endpoints require valid session token (except auth endpoints)
- Session tokens are HTTP-only cookies (CSRF-safe)
- Database uses Row Level Security (RLS) — users can only access their own data
- Service key is server-side only, never exposed to frontend

## Future: Payments Integration

The backend is structured for easy Stripe integration:

```
api/
├── payments/
│   ├── checkout.js        # Create Stripe checkout session
│   ├── webhook.js         # Handle Stripe webhooks
│   └── subscription.js    # Check subscription status
```

User table includes `subscription_status` and `subscription_ends_at` fields ready for use.

## Performance Notes

- Supabase handles auth without cold starts
- Database queries are indexed for fast lookups
- API functions are minimal (~50-100 lines each)
- Response caching headers set appropriately
