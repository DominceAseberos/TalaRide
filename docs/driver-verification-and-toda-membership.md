# Driver verification and TODA membership

Driver verification and TODA membership are independent records.

- Drivers register in the mobile app. Registration starts as `pending`.
- TalaRide admins see new registrations in the web dashboard and approve them after reviewing the submitted name, phone and license.
- A TODA operator adds an existing driver using the app's `DR-123456` code. The server assigns the operator's group; the request cannot choose another group or approve verification.
- The driver app checks account updates every 15 seconds, when reopened, and when “Check approval” is pressed. Approval opens the dashboard. Membership updates its group name. The last fetched account is cached per user for offline viewing.

## Account permissions

Permissions come from Supabase Auth **app metadata**, which is managed by a trusted administrator. Signup/user metadata and the TODA group typed into registration do not grant permissions. The existing public `profiles.role` column alone does not grant these backend roles.

For the existing administrator's Auth user, merge this into `app_metadata`:

```json
{ "role": "talaride_admin" }
```

For each approved TODA operator's Auth user, merge:

```json
{
  "role": "operator",
  "toda_group_id": "a-stable-unique-id-for-this-toda",
  "toda_group_name": "The actual TODA group name"
}
```

Use the same group ID for operators of the same TODA, and a different ID for every other group. The ID controls access; the name is displayed in the UI. An operator with no assigned group receives a clear error and cannot access member records.

Supabase's SQL editor can update a specific existing Auth account. Replace the email and metadata below with the approved account and its actual group. This does not create a password or new account. Preserve existing metadata by merging it:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'talaride_admin')
where lower(email) = lower('replace-with-admin-email');

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role', 'operator',
    'toda_group_id', 'replace-with-stable-group-id',
    'toda_group_name', 'replace-with-actual-TODA-name'
  )
where lower(email) = lower('replace-with-operator-email');
```

Then sign out and sign in to the web portal. Never run the admin update for an untrusted applicant.

## Storage and validation

Verification records include the approving admin and approval timestamp. Membership records include the group ID, adding operator and timestamp. Both use the existing durable `talaride_backend_state` cloud transaction; no new schema migration is required. Duplicate member additions are idempotent, other-group assignments return a conflict, and cloud errors cannot acknowledge a successful save.

Automated coverage exercises registration → pending queue → group assignment → admin approval → account/member updates, rejects unauthorized approval and forged group requests, retries competing cloud writes, and verifies mobile dashboard gating and offline membership caching.
