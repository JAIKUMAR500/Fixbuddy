# FixBuddy Android

Separate Android app. Same React UI (`frontend/`). Same Express API (`backend/`). No second backend.

```
android-app/
  capacitor.config.json     Capacitor wrap config
  src/                      App map (roles, screens, API, native)
    api/                    Existing Express API only
    config/                 App id, roles, v1 rules
    native/                 Permissions + shell (status bar, back)
    screens/                One folder per role
      auth/
      customer/
      worker/
      business/
      shared/
      admin/                Web only in v1
  android/                  Android Studio project — open this
```

## Run

You are already in `android-app` when the prompt shows `...\Untitled\android-app>`. Do **not** run `cd android-app` again.

If `npm` is missing after `nvm use`, close the terminal, open a new one, then:

```
cd C:\Users\nanopc\Desktop\Untitled\android-app
nvm use 22.23.2
npm run android:sync
npm run android:open
```

`android:open` needs Android Studio. Install: https://developer.android.com/studio

Until Studio is installed, open the website from the repo root:

```
cd C:\Users\nanopc\Desktop\Untitled
nvm use 22.23.2
npm run dev
```

Then visit `http://localhost:5173`.

Android Studio → Run on a device/emulator, or Build → Build APK.

The APK talks to the live API at `https://fixbuddy-1-nh5a.onrender.com` unless you set `VITE_API_URL` before sync.

Emulator + local backend: `VITE_API_URL=http://10.0.2.2:4000`

Admin stays on the website in v1.
