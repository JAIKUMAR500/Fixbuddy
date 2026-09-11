# FixBuddy

Service marketplace: customers post jobs, workers take them, businesses manage work, Super Admin runs the platform.

```
Fixbuddy/
  frontend/    React + Vite + Tailwind
  backend/     Express + MongoDB API
```

## Run locally

Terminal 1 — API:

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Terminal 2 — web app:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173  
API: http://localhost:4000

Super Admin: `admin@fixbuddy.com` / `password123`

## Uploads

Photos, SVG, and voice notes are saved on the API and returned as **URLs** (`/api/uploads/...`). You can also paste an image/SVG URL in the upload fields. Uploaded files are not stored in git.

## Cloud later

1. MongoDB Atlas for `MONGODB_URI`
2. Host `backend` (Render / Railway / Fly)
3. Host `frontend` (Vercel)
4. Set `VITE_API_URL` on Vercel to your Render URL (with or without `/api`)
5. Set `CLIENT_ORIGIN` (your Vercel URL) and `API_PUBLIC_URL` (your Render URL) on the backend.......
