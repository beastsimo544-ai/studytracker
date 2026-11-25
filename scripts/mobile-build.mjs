import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const nextBin = path.resolve("node_modules/next/dist/bin/next");
const publicApk = path.resolve("public/StudyTracker.apk");
const stashedApk = path.resolve(".stashed-StudyTracker.apk");

// Temporarily move public/StudyTracker.apk outside public/ during mobile build
// so the Android APK does not bundle a duplicate copy of itself inside assets!
let stashed = false;
if (fs.existsSync(publicApk)) {
  fs.renameSync(publicApk, stashedApk);
  stashed = true;
}

let exitCode = 1;
try {
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      CAPACITOR_BUILD: "true",
    },
  });
  exitCode = result.status ?? 1;
} finally {
  if (stashed && fs.existsSync(stashedApk)) {
    fs.renameSync(stashedApk, publicApk);
  }
}

process.exit(exitCode);
