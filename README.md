# Pacific Performance app

This app uses the same Firebase project, staff accounts and client profiles as pacificperformance.fit. Sign in with a website account. Clients are matched by their authenticated UID, not by a typed name or email.

## Release order

1. Merge and deploy https://github.com/metens/Pacific-Performance/pull/67 first. It provides authenticated `/api/portal?action=workout-plans` and `action=sessions` reads.
2. Deploy this app. Its `/api/portal` rewrite forwards authenticated requests to the production website. Existing website Firebase credentials remain server-side there; no new service-account key belongs in this app.
3. Sign in as active website admin, save a workout, then open Account → Send a workout to a client. Choose a linked client, saved workout and start date, and send.
4. Sign in as that client on both surfaces. App Workouts shows current and previous delivered plans; Account shows upcoming appointments. App reads refresh every 30 seconds. Website workout reads remain live.

Website Save & Deliver and app Send to client write `clients/{clientId}/workoutPlans` with the same day/exercise structure and delivered status. Drafts remain private. App sends archive previous delivered plans and update the client's latest-plan summary; they do not send an email. Website delivery retains its existing email notification.

The former app preview Firebase project is untouched. Its preview accounts, purchases and assignments are not migrated or deleted; use the website account for shared records. Device-local workouts and training history are unchanged. App coach access now follows the website's active `staffUsers` admin role, enforced by the website project's Firestore rules.

## Verification

Run `node --test tests/*.test.mjs`. Tests exercise workout conversion and publication into the shared collection. Authenticated browser verification still requires real website accounts after the website deployment; previews proxy the production website API.


## iPhone app

The native Capacitor/Xcode project, app icon, build scripts, and browser regression tests are in [`iphone/`](iphone/README.md). It bundles the shared `src/` screens locally and uses the existing Pacific Performance accounts and backend. See its README for setup, physical-device signing, and validation limits.
