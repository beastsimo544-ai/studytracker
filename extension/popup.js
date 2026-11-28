let dashboardUrl = "https://studytracker-e2vs.vercel.app/dashboard";

const CATEGORY_CYCLE = {
  distracting: "study",
  study: "neutral",
  neutral: "distracting",
};

const CATEGORY_LABELS = {
  distracting: "Distracting",
  study: "Study",
  neutral: "Neutral",
};

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safe === 0) return "0m";
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function sendMsg(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (res) => resolve(res));
  });
}

function renderState(res) {
  if (!res || !res.ok) return;
  if (res.dashboardUrl) dashboardUrl = res.dashboardUrl;

  const { summary, auth, lastSyncAt, lastSyncError, timerStatus } = res;
  const trackingBanner = document.getElementById("tracking-banner");
  const trackingText = document.getElementById("tracking-text");
  if (trackingBanner && trackingText) {
    if (timerStatus && timerStatus.active) {
      trackingBanner.className = "tracking-banner tracking-active";
      trackingText.textContent = timerStatus.subject
        ? `Tracking live · Studying ${timerStatus.subject}`
        : "Tracking live · Focus timer running";
    } else {
      trackingBanner.className = "tracking-banner tracking-standby";
      trackingText.textContent = "Standby · Start Focus Timer to track";
    }
  }

  const badge = document.getElementById("risk-badge");
  const headline = document.getElementById("risk-headline");
  const scoreEl = document.getElementById("risk-score");
  const marker = document.getElementById("gauge-marker");

  badge.textContent = summary.risk.label;
  badge.style.backgroundColor = `${summary.risk.color}26`;
  badge.style.color = summary.risk.color;
  badge.style.borderColor = `${summary.risk.color}66`;

  headline.textContent = summary.risk.headline;
  scoreEl.textContent = String(summary.risk.score);
  scoreEl.style.color = summary.risk.color;
  marker.style.left = `${summary.risk.score}%`;

  document.getElementById("distracting-time").textContent = formatDuration(
    summary.distractingSeconds
  );
  document.getElementById("total-time").textContent = formatDuration(
    summary.totalSeconds
  );
  document.getElementById("study-time").textContent = formatDuration(
    summary.studySecondsToday
  );

  const listEl = document.getElementById("sites-list");
  listEl.innerHTML = "";

  if (!summary.apps || summary.apps.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent =
      timerStatus && timerStatus.active
        ? "Timer running — visited sites will appear here."
        : "Start your Focus Timer to track distractions during study sessions.";
    listEl.appendChild(empty);
  } else {
    for (const app of summary.apps.slice(0, 8)) {
      const row = document.createElement("div");
      row.className = "site-row";

      const domain = document.createElement("span");
      domain.className = "site-domain";
      domain.textContent = app.name;

      const right = document.createElement("div");
      right.className = "site-right";

      const time = document.createElement("span");
      time.className = "site-time";
      time.textContent = formatDuration(app.seconds);

      const catBtn = document.createElement("button");
      catBtn.type = "button";
      catBtn.className = `cat-btn cat-${app.category}`;
      catBtn.textContent = CATEGORY_LABELS[app.category] || "Neutral";
      catBtn.addEventListener("click", async () => {
        const nextCategory = CATEGORY_CYCLE[app.category] || "distracting";
        await sendMsg({
          type: "SET_CATEGORY",
          domain: app.id,
          category: nextCategory,
        });
        await refresh();
      });

      right.appendChild(time);
      right.appendChild(catBtn);
      row.appendChild(domain);
      row.appendChild(right);
      listEl.appendChild(row);
    }
  }

  const signedOutBox = document.getElementById("signed-out-box");
  const signedInBox = document.getElementById("signed-in-box");
  const errEl = document.getElementById("auth-error");

  if (auth && auth.email) {
    signedOutBox.classList.add("hidden");
    signedInBox.classList.remove("hidden");
    document.getElementById("account-email").textContent = auth.email;
    const syncText = lastSyncAt
      ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Connected";
    document.getElementById("sync-status").textContent = syncText;
  } else {
    signedInBox.classList.add("hidden");
    signedOutBox.classList.remove("hidden");
  }

  if (lastSyncError) {
    errEl.textContent = lastSyncError;
    errEl.classList.remove("hidden");
  } else {
    errEl.textContent = "";
    errEl.classList.add("hidden");
  }
}

async function refresh() {
  const res = await sendMsg({ type: "GET_STATE" });
  renderState(res);
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-input").value.trim();
  const password = document.getElementById("password-input").value;
  const btn = document.getElementById("login-btn");
  const errEl = document.getElementById("auth-error");

  btn.disabled = true;
  btn.textContent = "Connecting...";
  errEl.classList.add("hidden");

  const res = await sendMsg({ type: "SIGN_IN", email, password });
  btn.disabled = false;
  btn.textContent = "Connect & Sync";

  if (!res || !res.ok) {
    errEl.textContent = res?.error || "Sign in failed.";
    errEl.classList.remove("hidden");
    return;
  }

  await refresh();
});

document.getElementById("sync-btn").addEventListener("click", async () => {
  const btn = document.getElementById("sync-btn");
  btn.disabled = true;
  btn.textContent = "...";
  await sendMsg({ type: "SYNC_NOW" });
  btn.disabled = false;
  btn.textContent = "Sync";
  await refresh();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await sendMsg({ type: "SIGN_OUT" });
  await refresh();
});

document.getElementById("open-dashboard-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: dashboardUrl });
});

refresh();
