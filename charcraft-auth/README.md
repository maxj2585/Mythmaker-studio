# charcraft-auth

Google Sign-In backend for CharCraft (https://charcraft-mythmaker.puter.site).

Env vars: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `DATABASE_URL` (Neon Postgres, for character sync), optional `ALLOWED_ORIGINS` (comma-separated).

Endpoints: `POST /api/auth/google` {token} -> {user, token}; `GET /api/auth/me` (Bearer); `POST /api/auth/logout`; `GET/PUT /api/sync` (Bearer) {characters, deleted}.
