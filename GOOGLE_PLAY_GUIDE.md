# Publishing StudyTracker on Google Play

StudyTracker is configured with **Capacitor** (`com.studytracker.app`) so a single codebase powers both your **Vercel website** and your **native Android app** (`android/`).

---

## 1. One-Time Setup on Your PC

1. Download and install **Android Studio**: https://developer.android.com/studio
   *(Android Studio installs Java/JDK, the Android SDK, and the App Bundle signing wizard automatically.)*

---

## 2. Syncing Changes & Testing on Android

Whenever you update your React/Next.js code, sync it into the Android project:

```powershell
npm.cmd run mobile:sync
```

Then open the native Android project in Android Studio:

```powershell
npm.cmd run mobile:open
```

In Android Studio:
1. Wait for **Gradle Sync** (bottom bar) to finish on first launch.
2. Either start a **Pixel Emulator** (Device Manager) or plug in your Android phone with **USB Debugging** enabled.
3. Click the green **Run (▶)** button at the top to launch StudyTracker as a native app!

---

## 3. Generating the Signed `.aab` File for Google Play

Google Play requires a signed **Android App Bundle (`.aab`)**:

1. Run `npm.cmd run mobile:sync` so `android/` has your latest code.
2. Open `android/` in Android Studio (`npm.cmd run mobile:open`).
3. *(For future updates)* In `android/app/build.gradle`, increment `versionCode` by `+1` (e.g. `1` -> `2`) and update `versionName` (e.g. `"1.0"` -> `"1.1"`).
4. In the top menu, click **Build → Generate Signed App Bundle / APK...**
5. Select **Android App Bundle** and click **Next**.
6. Under **Key store path**, click **Create new...**:
   - Save it outside the repo (e.g. `C:\Users\beast\Documents\studytracker-upload-key.jks`) — **back this file and password up safely!**
   - Fill in a password, alias (`upload`), and your name, then click **OK** → **Next**.
7. Select **release** and click **Create**.
8. Android Studio will generate your Play Store bundle at:
   `android/app/release/app-release.aab`

---

## 4. Uploading to Google Play Console

1. Create a developer account at https://play.google.com/console (one-time \$25 registration fee).
2. Click **Create app** → Name: **StudyTracker**, App/Game: **App**, Free/Paid: **Free**.
3. Complete the **App content** checklist:
   - **Privacy Policy URL:** `https://studytracker-e2vs.vercel.app/privacy` *(included in `src/app/privacy/page.tsx`!)*
   - **Ads:** No ads.
   - **App access:** Provide a test email & password so Google Play's reviewer can sign in and test the timer, subjects, and friends tabs.
   - **Data safety:**
     - Collects data? **Yes** (Email address, User IDs/username, App activity/study sessions)
     - Encrypted in transit? **Yes** (HTTPS via Supabase)
     - Data shared with third parties? **No**
4. Complete **Main store listing** (512×512 app icon, 1024×500 feature graphic, and 2–8 mobile screenshots).
5. Upload `android/app/release/app-release.aab` under **Testing → Closed testing** (personal Play accounts require a 14-day closed test with 12 testers before unlocking **Production**).
