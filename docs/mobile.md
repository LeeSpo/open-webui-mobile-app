# Open WebUI Android client

The Android app ships the official Open WebUI frontend inside the APK and talks
to an existing Open WebUI server for API, WebSocket, files, RAG, tools, and
sandbox traffic. The web UI and the app share the same users, chats, models,
and data.

## Architecture

- Local: JS, CSS, fonts, icons, wasm, pyodide, i18n, emoji
- Remote: `/api`, `/ollama`, `/openai`, `/oauth`, `/ws`, `/cache`
- Server URL is stored on device (`owui.serverBaseUrl`) and applied through
  `src/lib/runtime/` plus live bindings in `src/lib/constants.ts`
- `/api/config` must send the Bearer token. The WebView origin is
  `https://localhost`, so the httponly login cookie is not sent on that
  cross-origin request. Without the token the server omits authenticated
  feature flags (`enable_web_search`, `enable_code_interpreter`, …) and the
  chat integrations menu hides Web Search and Code Interpreter.
- `<img>` does not send the Bearer token either. Model/user avatars
  (`/api/v1/.../profile/image`) and `/cache` images 401 unless the network
  gate fetches them with the token and assigns a blob URL. Frontend assets
  (`/assets/emojis`, `/static/favicon.png`) must stay on the APK; prefixing
  them with the server URL 404s because the Python backend does not serve
  the packed web UI.

Do not scatter server URLs through `src/lib/apis/**`.

## Build

```sh
npm install
npm run mobile:sync
npx cap open android
```

`mobile:sync` runs `npm run build` (static SPA into `build/`) and copies it
into the Android project. The Python backend is not packaged.

Debug APK:

```sh
# JAVA_HOME should be JDK 17 or 21 (not 25)
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run mobile:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
If Google Maven is unreachable, the build uses `android/gradle/init.aliyun.gradle`.

Android Studio / Gradle need JDK 17 or 21. Newer JDKs (25+) fail Capacitor's Gradle 8.11 wrapper with `Unsupported class file major version`.

## Server configuration

Most deployments already allow the app because `CORS_ALLOW_ORIGIN` defaults to
`*`. If you pin origins, include the Capacitor WebView origin:

```
CORS_ALLOW_ORIGIN=https://your-web-domain;https://localhost
CORS_ALLOW_CUSTOM_SCHEME=openwebui
```

Password and LDAP login work with no server code changes.

### OAuth (optional)

Set an allowlist of app-scheme callbacks, then restart the server:

```
WEBUI_APP_REDIRECT_URIS=openwebui://auth
```

The app opens `/oauth/{provider}/login?app_redirect=openwebui://auth` in a
Custom Tab. After login the server redirects to `openwebui://auth?token=JWT`.
If `WEBUI_APP_REDIRECT_URIS` is unset, OAuth behavior is unchanged for the web.

## Syncing with upstream Open WebUI

Add the official repo as `upstream` and merge it periodically. Expected touch
points:

- New: `src/lib/runtime/`, `src/routes/setup/`, `android/`, `capacitor.config.ts`, `docs/mobile.md`
- Small patches: `src/lib/constants.ts`, `src/routes/+layout.svelte`, `src/routes/auth/+page.svelte`, `src/routes/error/+page.svelte`, `src/lib/components/chat/Settings/About.svelte`, `package.json`
- Optional server: `backend/open_webui/env.py`, `backend/open_webui/utils/oauth.py`

If upstream adds another `*_API_BASE_URL` in `constants.ts`, add it to
`applyRuntimeBaseUrl()`.

## License

Keep Open WebUI branding (name, logo, and UI identifiers) as required by
`LICENSE`.
