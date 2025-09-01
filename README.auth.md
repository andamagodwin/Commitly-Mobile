Auth (Appwrite + GitHub)

Prereqs
- Appwrite project with OAuth provider GitHub enabled (Auth > Providers).
- Platforms added in Appwrite console with:
  - iOS bundleIdentifier: com.commitly.app
  - Android package: com.commitly.app
- .env contains:
  - EXPO_PUBLIC_APPWRITE_ENDPOINT=https://<region>.cloud.appwrite.io/v1
  - EXPO_PUBLIC_APPWRITE_PROJECT_ID=...
  - EXPO_PUBLIC_APPWRITE_PLATFORM_ID=com.commitly.app

Flow
1) Tap "Sign in with GitHub" in app.
2) SDK opens browser to Appwrite OAuth login.
3) After success, Appwrite redirects to commitly://auth-callback?userId=...&secret=...
4) App consumes the deep link and calls account.createSession(userId, secret), then account.get().

Notes
- No client secret is stored in the app. Appwrite handles provider exchange.
- You must run a Development Build or in Expo Go on web. For native OAuth in Expo Go, use a dev build.
