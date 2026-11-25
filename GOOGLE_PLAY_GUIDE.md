# Publishing & Installing StudyTracker on Android

StudyTracker is configured with **Capacitor** (`com.studytracker.app`), a custom StudyTracker app icon (`public/playstore-icon-512.png`), and an **automated GitHub Actions Android builder** (`.github/workflows/android-build.yml`).

---

## Option A: Automatic Cloud `.apk` & `.aab` Build (No Android Studio Needed!)

Every push to `main` (or manual click in GitHub Actions) compiles an installable **Android `.apk`** for your phone and an **Android App Bundle (`.aab`)** in the cloud:

1. Open your GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**, and add the same two values from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. Go to the **Actions** tab on GitHub → select **Build Android APK & AAB** → click **Run workflow**.
3. When it finishes (~3 minutes), scroll down to **Artifacts**:
   - Download **`StudyTracker-Android-APK`**, unzip it, send `app-debug.apk` to your Android phone (or your friends' phones), and tap to install!

---

## Option B: Building a Signed Google Play `.aab` in Android Studio

To upload to **Google Play Console**, Google Play requires your `.aab` to be signed with your personal upload keystore:

1. Download **Android Studio**: https://developer.android.com/studio
2. Sync your latest web code into `android/` and open Android Studio:
   ```powershell
   npm.cmd run mobile:sync
   npm.cmd run mobile:open
   ```
3. In the top menu, click **Build → Generate Signed App Bundle / APK... → Android App Bundle**.
4. Under **Key store path**, click **Create new...** (save your `.jks` file outside the repo and back up the password!).
5. Choose **release** → click **Create** → upload `android/app/release/app-release.aab` to https://play.google.com/console.

---

## Google Play Store Listing Quick Reference

- **512×512 App Icon:** Ready at `public/playstore-icon-512.png`
- **Privacy Policy URL:** `https://studytracker-e2vs.vercel.app/privacy`
- **In-App Account Deletion:** Included at **Settings → Delete Account** (`/settings`)
- **Data Safety Answers:**
  - Collects data: **Yes** (Email address, Username/Avatar, Study session logs)
  - Encrypted in transit: **Yes** (HTTPS via Supabase)
  - Shared with third parties: **No**
