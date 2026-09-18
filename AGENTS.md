# FixBuddy

React + Vite frontend in `frontend/`. Express API in `backend/`. React Native (Expo) in `mobile/`.

- `frontend/src/main.tsx` — React web entry
- `frontend/src/App.tsx` — web app shell and routes
- `backend/src/index.js` — API entry
- `mobile/` — React Native phone app (same API, Expo Go)
- `android-app/` — older Capacitor wrap of the website (not React Native)
- Uploads are stored as files and served as URLs (`/api/uploads/...`). SVG and remote image URLs are supported.
