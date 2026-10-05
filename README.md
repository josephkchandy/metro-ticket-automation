# Kochi Metro Helper

A personal Android app that starts my usual metro booking from a home-screen shortcut: **Kadavanthra → S N Junction, one passenger, one way**.

I was repeating the same steps every day: open the metro WhatsApp chat, send `Hi`, tap **Book Ticket**, open the fresh link, select my stations and request the fare. This app automates those steps. I review the fare, tap the website's **Book Ticket** button and approve payment myself.

This is an **unofficial personal project**, with no affiliation with Kochi Metro, WhatsApp or the booking provider. It has no ads, subscriptions or app backend.

## How it works

1. A home-screen shortcut starts the app.
2. The app opens the configured metro bot in WhatsApp with `Hi` prepared.
3. An Accessibility service checks the chat header, sends `Hi` once and taps **Book Ticket**.
4. It ignores previously visible links and captures a fresh booking link.
5. A WebView opens that link, selects the fixed route and requests the current fare.
6. Automation stops at fare review. Booking confirmation and payment remain manual.

The WhatsApp helper stops after 90 seconds or when the user leaves the recognized chat. The form helper also has a timeout. Neither runs on a repeating schedule. A share/paste-link fallback works without Accessibility.

## Status

The original `0.1-prototype` APK was reported working on the project owner's phone on **5 October 2026**. This is a personal-device test; compatibility across devices and the complete payment flow have not been independently verified.

This repository contains the original Accessibility-based application source. Documentation and ignore rules have been prepared for publication. The private signing key and APK are excluded.

## Setup

Requires Android 8.0 or newer and ordinary WhatsApp with an English interface. WhatsApp Business is not supported by the current package checks.

1. Build and install the app.
2. Verify the configured number and chat header against the official bot you already use. The current source uses `+91 XXXXXXXXXX` and **Kochi Metro Rail Limited**; these values may need maintenance.
3. Tap **Enable WhatsApp helper** and enable the named service in Android Accessibility settings.
4. Return, tap **Start my booking** and confirm the first-run setup.
5. Keep the phone unlocked and stay in the metro chat while it runs.
6. Check the route and fare. Tap **Add home-screen button** for future trips.

Android may restrict installation or Accessibility access for sideloaded apps. Granting a permission does not itself resolve an installation block. Compatibility with device security settings is not guaranteed.

Booking links expire. The app uses fresh links from the bot; it does not fabricate tokens or renew expired links. Fares are retrieved from the website rather than hardcoded. WhatsApp selectors and booking-page controls may need maintenance after service updates.

## Permissions and data

- Internet access loads the website; Accessibility reads and clicks WhatsApp controls after checking the metro chat header.
- No contacts, SMS or notification-reading permissions are requested.
- No analytics or chat-upload server is included.
- Chat text and candidate links are held temporarily in memory, not deliberately saved to disk by the helper.
- Setup consent and a shortcut token are stored in private preferences.
- The website uses ordinary WebView cookies, caches and DOM storage. Clearing Android app storage clears those local records.
- The helper stops before the booking page opens and does not operate payment apps or enter a UPI PIN.

Accessibility is a powerful permission. The code's intended scope is narrower than the capability Android grants; review the source before enabling it.

## Build

No third-party runtime dependencies. The Gradle configuration uses Android Gradle Plugin 8.7.3, compile/target SDK 35 and minimum SDK 26. Use JDK 17 and Gradle 8.9. A Gradle wrapper is not bundled.

With a compatible Gradle installation:

```sh
gradle assembleDebug
```

The standalone script requires Java 17, Android SDK platform 35, build-tools 35.0.0, Python 3 and `keytool`. Use either `javac` or Eclipse ECJ 3.37.0:

```sh
ANDROID_SDK_ROOT=/path/to/sdk bash build-local.sh

# If using ECJ instead of javac:
ANDROID_SDK_ROOT=/path/to/sdk ECJ_JAR=/path/to/ecj-3.37.0.jar bash build-local.sh
```

Output: `build/Metro-to-SN-prototype.apk`.

The script generates a local prototype signing key when one is missing, using a development password. Keep the key private and retain it for future updates. A new key cannot update an installation signed with another key. Production distribution would need a separate signing setup.

## Checks

Synthetic tests cover URL validation, route/passenger selection, a single fare request, no purchase-button click, foreign-host rejection, expired links and route changes.

```sh
node tests/autofill.test.cjs
mkdir -p build/policy-tests
javac -d build/policy-tests \
  app/src/main/java/in/joseph/metrosn/BookingPolicy.java \
  tests/BookingPolicyTest.java
java -cp build/policy-tests in.joseph.metrosn.BookingPolicyTest
```

The original APK also passed resource linking, Java compilation, DEX creation and signature verification. These checks do not replace real-device testing.

## Source map

| File | Purpose |
| --- | --- |
| `MetroService.java` | Bounded WhatsApp state machine and chat checks |
| `MainActivity.java` | Setup, shortcut, shared links and WebView |
| `BookingPolicy.java` | Booking URL validation |
| `assets/autofill.js` | Route selection and fare lookup |

To adapt the route, change the labels in `MainActivity.java` and the station names in `assets/autofill.js`, then update the form tests.

## Development

The initial prototype was implemented with AI assistance. The project owner supplied the commuting problem, route, requirements and phone testing. This repository makes the implementation inspectable and reusable.

## License

MIT; see [LICENSE](LICENSE).
