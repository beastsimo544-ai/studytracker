import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const nextBin = path.resolve("node_modules/next/dist/bin/next");

const stashTargets = [
  {
    src: path.resolve("public/StudyTracker.apk"),
    stash: path.resolve(".stashed-StudyTracker.apk"),
  },
  {
    src: path.resolve("public/StudyTracker-Extension.zip"),
    stash: path.resolve(".stashed-StudyTracker-Extension.zip"),
  },
  {
    src: path.resolve("src/app/api"),
    stash: path.resolve(".stashed-api"),
  },
];

// Temporarily stash large downloadable archives and Next.js server API routes
// during mobile static export so the Android APK never bundles them or fails export.
const stashedItems = [];
for (const target of stashTargets) {
  if (fs.existsSync(target.src)) {
    fs.renameSync(target.src, target.stash);
    stashedItems.push(target);
  }
}

let exitCode = 1;
try {
  const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
    stdio: "inherit",
    env: {
      ...process.env,
      CAPACITOR_BUILD: "true",
    },
  });
  exitCode = result.status ?? 1;
} finally {
  for (const target of stashedItems) {
    if (fs.existsSync(target.stash)) {
      fs.renameSync(target.stash, target.src);
    }
  }
}

process.exit(exitCode);
