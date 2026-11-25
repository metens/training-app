# Session calendar and notifications

The app now provides readable appointment labels in the phone’s time zone, Apple’s calendar event editor (iOS 17+), and opt-in local reminders one hour before each loaded future session. Signed-out and switched accounts clear the previous account’s pending reminders. Calendar exports are copies: subsequent session changes do not update those copies.

## Current build

Local reminders work without paid Apple membership. Enable them from Account after signing in and permit notifications. The app refreshes appointments when foregrounded. Open the app after a reschedule/cancellation so pending reminders match the current schedule. Up to the nearest 60 future reminders are scheduled. Sessions loaded less than one hour before starting do not receive a late reminder.

Remote session-change alerts are implemented but deliberately disabled. No APNs credentials are bundled. The build remains compatible with personal-team signing.

## Activate remote alerts after enrollment

1. Enable Push Notifications for the app identifier in the paid Apple Developer team. In Xcode, add the Push Notifications capability to the App target and regenerate signing profiles. Keep the bundle identifier and APNs topic identical.
2. Set `PPRemoteNotificationsEnabled` to true in App/Info.plist and rebuild/install. Debug registration uses the sandbox APNs environment; release uses production. Use matching signing profiles.
3. Deploy the companion Pacific-Performance notification endpoints and configure their server-only APNs variables (see that repository’s SESSION-NOTIFICATIONS.md).
4. Sign in and enable session notifications in Account. If reminders were already enabled, reopen the app to register remote alerts.
5. On a dedicated test account, test creation, rescheduling, cancellation, notification tap, permission denial, sign-out and account switching on a real device. Verify a one-hour reminder while the app is closed. Do not use real client sessions for testing.

Remote alerts are sent after staff calendar saves; a failed send offers retry. They do not silently refresh local reminders while the app is closed. Tap an alert/open the app to update those reminders. Reliable background cancellation would require an additional server-driven reminder delivery workflow.

## Verification

`npm test` in iphone runs unit and browser checks. Native compile validation uses the App scheme. Browser tests mock Apple Calendar, notification permission, scheduling and API responses; they cannot validate Apple’s delivery service or real-device focus/keyboard behavior.
