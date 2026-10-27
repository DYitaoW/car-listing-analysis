# Supabase Auth + Google for SignalCheck

## What you get

- Email/password sign-in and sign-up on `/login`
- Continue with Google (once enabled in Supabase)
- Listing checks saved to the signed-in user
- **My listings** at `/listings`

## Dashboard steps

1. Open your Supabase project → **Authentication → Providers**
2. Enable **Email**
3. Enable **Google**
   - In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth 2.0 Client ID (Web)
   - Authorized redirect URI must be the Supabase callback:
     `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Paste the Client ID and Client Secret into Supabase
4. **Authentication → URL configuration**
   - Site URL: `http://127.0.0.1:43123`
   - Additional Redirect URLs: `http://127.0.0.1:43123/auth/callback`

## Env vars

Put these in the repo-root `.env` (and restart web + API):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...          # Project Settings → API → JWT Secret
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
AUTH_REQUIRED=true
```

`SUPABASE_JWT_SECRET` lets the FastAPI server verify access tokens locally. If it is blank but the anon key is set, the API falls back to calling Supabase Auth’s `/user` endpoint.

## Local without Auth

Leave the Supabase Auth vars empty. The checker stays usable without sign-in, and listings are not tied to an account.
