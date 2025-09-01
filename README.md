# Commitly auth setup (GitHub OAuth)

Quick steps to enable GitHub login in this Expo Router app.

## 1) Create a GitHub OAuth App
- Go to https://github.com/settings/developers > OAuth Apps > New OAuth App
- Application name: Commitly (or anything)
- Homepage URL: https://example.com (placeholder)
- Authorization callback URL:
  - Development build/native: commitly://
  - Web: https://localhost:19006 (dev) or your production URL

GitHub allows only one callback URL per OAuth app. Use a separate app if you also need a web callback.

## 2) Environment variables
Create `.env` with:

```
EXPO_PUBLIC_GITHUB_CLIENT_ID=<your_client_id>
EXPO_PUBLIC_API_BASE_URL=<your_backend_base_url>
```

The backend must implement POST /auth/github/exchange that receives `{ code, redirectUri }` and exchanges it for an access token with your client secret server-side.

## 3) Run locally
- Install deps: `npm i`
- Start: `npm run start`
- Use a Development Build for OAuth flows on devices/simulators. See: https://docs.expo.dev/develop/development-builds/introduction

## 4) Files
- `app/login.tsx`: GitHub sign-in UI using expo-auth-session
- `store/auth.ts`: Persisted auth state with expo-secure-store
- `app/_layout.tsx`: Sets initial route to `login` and registers stacks

## Notes
- Never embed the GitHub client secret in the app. Always exchange the code on a server.
- Redirect scheme is `commitly` via `app.json`.
