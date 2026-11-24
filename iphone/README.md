# Pacific Performance iPhone app

Open `ios/App/App.xcodeproj` in Xcode. Run the setup commands below before opening Xcode. Select your own development team under Signing & Capabilities to run on a physical iPhone.

The app bundles its screens, Firebase client SDK and exercise images locally. It opens on Pacific Performance email/password sign-in. Vercel authentication is not involved and no deployment-protection settings were changed.

## Rebuild

1. `npm ci`
2. `node build.mjs` (reads the repository’s `../src` directory)
3. `npx cap sync ios`
4. Build the App scheme in Xcode for an iPhone simulator.

Sign-in uses the existing Pacific Performance Firebase project, with email/password authentication and local session persistence. The native build omits the browser popup/redirect resolver so startup does not depend on a hosted authentication iframe. Authenticated portal requests go to `https://pacificperformance.fit/api/portal` through Capacitor's native HTTP API and retain the user's Firebase bearer token. Server authorization is unchanged. No bypass credentials are bundled. Network access is required for sign-in and account data.

Signed-out navigation is hidden for the client experience; this is not a replacement for server access rules. Signing out clears the displayed account data through the existing account flow. A real account is needed to verify authenticated workouts and messaging, and sends/saves affect real records.

The app icon uses the white tree-and-barbell mark on a dark green background. Privacy declarations, native notifications and full physical-device verification remain later steps. This project is a local development preview and has not been submitted to Apple.

## Regression checks

Run `npm test` from this folder. Browser checks use an isolated Chrome profile, a local server, and test-only Firebase/API adapters; they do not write to client accounts. One startup check loads the real bundled authentication code. Chrome must be installed. Native simulator builds and authenticated live-server checks are separate from these simulated scenarios.

Client-created workout templates and manually logged PRs are now stored per signed-in account. Older unscoped values are left untouched in local storage, but are not automatically assigned to a client because their owner cannot be established safely.

### Validation — November 23, 2026

- 5 unit checks passed: app-to-website plan formatting/delivery, bodyweight and timed prescriptions, and rejection of empty plans or unlinked client accounts.
- 13 Chrome browser checks passed: real bundled signed-out startup; simulated authentication failure/retry; navigation and hidden storefront/sample; workout creation/completion/persistence; account separation; invalid weight rejection; assigned plan/session rendering; long-press reactions; offline save/reconnect; message retry with stable ID; reaction request payload; exercise graphics and narrow-screen layout.
- Live read-only checks: unsigned requests to workout plans, sessions, messages, and workout history each returned 401 with a sign-in error. The user signed into the native simulator and existing workout history rendered. The updated native build compiled and installed successfully; after relaunch, the user remained signed in and the same history rendered.
- Fixed: per-client storage for routines/manual PRs, blank/nonfinite workout weight validation, and reaction controls visible before a long press.
- Not yet verified: physical-iPhone keyboard/touch/background behavior, actual message sending/receiving and cross-device plan delivery with a designated test coach/client pair, password-reset delivery, and release signing/App Store submission requirements. Simulated API responses are not evidence of live writes or complete authorization coverage.
