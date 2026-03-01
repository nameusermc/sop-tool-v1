# WithoutMe — Data Deletion Process

**For:** Handling deletion requests received at support@withoutme.app  
**Legal basis:** Privacy Policy Section 11 (Your Rights), Section 12 (California Privacy Rights)  
**Response deadline:** Within 30 days of verified request (GDPR/CCPA requirement)

---

## When a Deletion Request Arrives

### Step 1: Verify Identity
- Confirm the requester's email matches an account in Supabase Auth
- If the request comes from a different email, ask them to send from their account email
- Do NOT delete based on unverified requests

### Step 2: Acknowledge Receipt
Reply within 2 business days:

> Hi [Name],
>
> We've received your account deletion request and will process it within 30 days.
>
> This will permanently delete your account and all associated data from our servers, including SOPs, team data, completion records, and feedback. Any data stored locally in your browser is not affected — you can clear that through your browser settings.
>
> If you have an active Pro subscription, please cancel it first through your account settings or the Paddle customer portal. If you need help with this, let us know.
>
> We'll confirm once the deletion is complete.
>
> — WithoutMe Support

### Step 3: Check Subscription Status
- Go to Supabase Dashboard → Table Editor → `subscriptions`
- Search by the user's email
- If there's an active subscription, reply asking them to cancel first (via Paddle customer portal), OR cancel it on their behalf in the Paddle vendor dashboard

### Step 4: Delete Data (Supabase Dashboard → Table Editor)

Delete in this order (respects foreign key relationships):

| Order | Table | Filter | What It Contains |
|-------|-------|--------|-----------------|
| 1 | `task_assignments` | `team_id` matches user's team | SOP assignments to team members |
| 2 | `team_feedback` | `team_id` matches user's team | Team member feedback on SOPs |
| 3 | `team_completions` | `team_id` matches user's team | Checklist completion records |
| 4 | `team_members` | `team_id` matches user's team | Named team member records |
| 5 | `teams` | `owner_id` = user's auth ID | Team record itself |
| 6 | `checklists` | `user_id` = user's auth ID | Saved checklist states |
| 7 | `sops` | `user_id` = user's auth ID | All SOPs and their content |
| 8 | `folders` | `user_id` = user's auth ID | Folder organization |
| 9 | `subscriptions` | `customer_email` = user's email | Billing/subscription record |
| 10 | Auth → Users | Find user by email → Delete | Auth account itself |

**To find the user's auth ID:** Supabase Dashboard → Authentication → Users → search by email → copy the UUID.

**To find team_id:** Supabase Dashboard → Table Editor → `teams` → filter by `owner_id` = user UUID.

### Step 5: Confirm Deletion
Reply to the user:

> Hi [Name],
>
> Your account and all associated data have been permanently deleted from our servers. This includes your SOPs, team data, completion records, feedback, and account information.
>
> Any data stored locally in your browser can be cleared through your browser settings (Settings → Clear browsing data → select "Site data" for withoutme.app).
>
> Thank you for using WithoutMe. If you ever want to come back, you're welcome anytime.
>
> — WithoutMe Support

### Step 6: Log the Request
Keep a simple record (spreadsheet or note) with:
- Date of request
- User email (then delete after logging)
- Date completed
- Notes (e.g., "had active sub — canceled first")

This log demonstrates compliance if ever audited.

---

## Edge Cases

**User has no account (Free tier only):**  
All their data is in localStorage on their device. Reply explaining this — we have nothing to delete on our side. Point them to browser settings to clear local data.

**User's team members have completion data:**  
Team completion records are deleted as part of the cascade above. Team members' link-based access stops working once the team is deleted.

**User wants to keep SOPs but delete account:**  
Suggest they export SOPs to PDF first (available in the app), then proceed with deletion.

**Request from EU resident citing GDPR Article 17:**  
Same process. The 30-day timeline applies. Acknowledge citing their rights under GDPR.

**Request from California resident citing CCPA:**  
Same process. Acknowledge citing their rights under CCPA/CPRA.
