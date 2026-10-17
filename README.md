# המשימות של רן

Android: Capacitor app `il.co.karisi.ran` (APK via GitHub Releases). The web/PWA version was retired on 2026-10-17; an archive is in `web-archive/`. Root `index.html` is the APK web source.

## Build
```
npm ci && npm run sync
cd android && ANDROID_KEYSTORE_FILE=/path/release.jks ANDROID_KEYSTORE_PASSWORD=... ./gradlew assembleRelease
```
CI (move `ci/android-release.yml` to `.github/workflows/` — needs a token with workflow scope): push a tag `v*` → `.github/workflows/android-release.yml` builds a signed APK and attaches it to the release.
Repo secrets required: `ANDROID_KEYSTORE_B64` (base64 of the .jks), `ANDROID_KEYSTORE_PASSWORD` (store + key password, alias `ran`).

## Google sign-in / Drive backup
Set `GOOGLE_WEB_CLIENT_ID` at the top of the script in `index.html` to the **Web** OAuth client ID
(the Android OAuth client must also exist with package `il.co.karisi.ran` and the signing SHA-1). Scope: `drive.appdata`.

## Security
- Local data and attachments are encrypted with AES-256-GCM (WebCrypto). On Android the 256-bit data key is stored
  via SecureStorage, wrapped by an Android Keystore key; on web it is a non-extractable CryptoKey in IndexedDB.
- Backup goes to the Drive `appDataFolder` (hidden, app-private), over TLS, with only the `drive.appdata` scope.
