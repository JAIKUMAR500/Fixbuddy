# FixBuddy mobile (Expo)

Android-first client of the **existing** Express API. Does not replace `frontend/` or `backend/`.

```
WEB APP  ──┐
           ├── FIXBUDDY API ── MongoDB
MOBILE  ───┘
```

## Run

```
cd mobile
nvm use 22.23.2
npm start
```

Open in Expo Go. Uses `EXPO_PUBLIC_API_URL` (live Render by default so the phone can reach it).

Website local: `npm run dev` at repo root + `npm run dev:backend`.

Google sign-in is on the website only for now (needs native Google config).
Auth OTP is 6 digits, same as the website — not 4.
