# 2048
Falling-block number puzzle. Blocks stack from the top; shoot the next block up a column and matching neighbours merge.

**Play online:** [game-fa643.web.app](https://game-fa643.web.app)

**Want to publish? See [SUBMIT.md](SUBMIT.md) — a click-by-click guide for Google Play and the Apple App Store.**

## Run
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8000` then visit http://localhost:8000

## Free Google hosting (Firebase Hosting)
This game is a static website, so it can be deployed with Firebase Hosting without a server. The included `firebase.json` serves only the web assets in `number-merge/www` and does not publish the Android or iOS project files.

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/) and use the no-cost Spark plan.
2. Install the Firebase CLI: `npm install -g firebase-tools`
3. From this repository's root folder, run:

   ```
   firebase login
   firebase use --add
   firebase deploy --only hosting
   ```

   When prompted, select the Firebase project you created. Firebase will print your public `*.web.app` URL after deployment.

Hosting is free within Firebase's no-cost plan limits; check the Firebase usage dashboard as traffic grows. This publishes the website, not an Android app on Google Play.

## Controls
Tap a column (or drag and release). Desktop: click, or arrow keys + Space.

## Rules
- Touching equal numbers merge (chains allowed). Game over when every column is full.
- Blocks are 2/4 until you make an 8; then every 5th block is a bigger one (8 up to half your biggest number).
- Power-ups cost coins: Hammer 150, Swap 175, Undo 75.

## Scaling / performance (many users at a time)
The game is 100% client-side: there is no server, no database, and no per-user backend cost. Every player runs the game on their own device, so any static host (GitHub Pages, Netlify, Firebase Hosting, Cloudflare Pages) serves unlimited simultaneous users out of the box — "more users" costs you nothing extra.

What was optimized in the code (game.js) so each device handles the game smoothly under load:
- Rendering pauses when the browser tab is hidden (no wasted CPU/battery in background tabs).
- Adaptive quality: on slow frames the renderer drops drop-shadows and reduces particle counts automatically, keeping 60fps on weak phones.
- Debounced resize (one reflow per frame max) and a single cached `getBoundingClientRect` per pointer event.
- Duplicate timer/animation leaks fixed (score-pop timer reuse, guarded settle/merge chains, no key auto-repeat).
- Hammer/Swap/Undo are now fully state-guarded (no payments or board changes after game over or mid-animation).

If you later want cross-device features (cloud leaderboard, saved games, accounts), that's when you add a small backend (e.g. Firebase/Supabase) — the front-end code above already scales to any number of concurrent players.

## Android APK / AAB (Google Play Store)
Google Play requires an **AAB** (Android App Bundle). Using Capacitor:

```
npm install                 # installs @capacitor/core, cli, android
mkdir www & copy index.html style.css game.js manifest.json icon-192.png icon-512.png www\
npx cap add android         # creates the android/ project (uses capacitor.config.json)
npx cap sync                # copies www/ into the native project
npx cap open android        # opens Android Studio
```
In Android Studio: **Build > Generate Signed Bundle / APK > Android App Bundle**, sign it with your upload key (create one in **Build > Generate Keystore** — keep this key safe, Play won't let you update the app without it), then upload the `.aab` to the [Google Play Console](https://play.google.com/console) ($25 one-time developer fee) and fill in the store listing (screenshots, description, privacy policy).

Tip: in Android Studio use **Tools > App Links Assistant / Image Asset** if you want to replace the generated `icon-*.png` with higher-resolution branded icons.

## Store checklist (updates)
- **appId**: change `com.yourname.numbermerge` in `capacitor.config.json` to your own reverse-domain ID **before** your first upload (it can never change afterwards without a new store listing).
- **Every update needs higher versions**: in Android Studio bump `versionCode` (and `versionName`); in Xcode bump `CFBundleVersion`. `package.json` is bumped to 1.0.1 for the next release.
- **iOS icon**: App Store Connect requires a 1024×1024 PNG with no transparency — use `icon-1024.png` (upload in App Store Connect > App Information > App Store Icon).
- **Android back button** is now handled (closes overlays → pauses → exits) via `@capacitor/app`; run `npm install` after pulling these changes so the plugin is present, then `npx cap sync`.
- **iOS sound**: AudioContext is unlocked on the first touch, so effects play from the first tap on iPhones.
- **Privacy**: the app has no permissions, ads, tracking, or network calls — on Play Console choose "No data collected"; on App Store Connect the privacy questions are all "No".
- **targetSdk**: Capacitor 6 targets Android SDK 34. If Google Play rejects for an outdated target SDK, upgrade to Capacitor 7 (`npm i @capacitor/core@^7 @capacitor/cli@^7 @capacitor/android@^7 @capacitor/ios@^7 @capacitor/app@^7`) then `npx cap sync`.

## iOS (App Store)
Requires a Mac + Apple Developer account ($99/yr):
```
npx cap add ios && npx cap sync
npx cap open ios            # Xcode: set your Team, then Product > Archive > Distribute App
```
In Xcode set the deployment target to iOS 14+ and enable "Audio, AirPlay, and Picture in Picture" only if you add background audio (not needed here).

## PWA (installable, no store fees)
Serve the folder over HTTPS (Netlify/Cloudflare/GitHub Pages). `manifest.json` + icons are already wired into `index.html`, so users can "Add to Home Screen" and it runs fullscreen like a native app.
