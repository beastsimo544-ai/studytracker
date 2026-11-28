(() => {
  function isExtensionAlive() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function readLocalTimerStatus() {
    const now = Date.now();
    const fallback = {
      active: false,
      subject: null,
      timerMode: "stopwatch",
      startedAt: null,
      endsAt: null,
      updatedAt: now,
    };
    try {
      const raw = window.localStorage.getItem("studyTimer");
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const timerMode = parsed?.timerMode === "pomodoro" ? "pomodoro" : "stopwatch";
      const isFocusPhase = timerMode === "stopwatch" || parsed?.pomodoroPhase !== "break";
      const startedAt = typeof parsed?.startedAt === "number" ? parsed.startedAt : null;
      const accumulatedMs =
        typeof parsed?.accumulatedMs === "number" ? Math.max(0, parsed.accumulatedMs) : 0;
      const focusMinutes =
        typeof parsed?.focusMinutes === "number" && parsed.focusMinutes > 0
          ? parsed.focusMinutes
          : 25;
      const endsAt =
        timerMode === "pomodoro" && isFocusPhase && parsed?.isRunning && startedAt !== null
          ? startedAt + Math.max(0, focusMinutes * 60 * 1000 - accumulatedMs)
          : null;
      const active = Boolean(
        parsed?.isRunning &&
          startedAt !== null &&
          isFocusPhase &&
          (endsAt === null || now < endsAt)
      );
      return {
        active,
        subject:
          typeof parsed?.selectedSubject === "string" && parsed.selectedSubject
            ? parsed.selectedSubject
            : null,
        timerMode,
        startedAt: active ? startedAt : null,
        endsAt: active ? endsAt : null,
        updatedAt: now,
      };
    } catch {
      return fallback;
    }
  }

  function forwardState(triggerSync) {
    if (!isExtensionAlive()) return;
    try {
      chrome.runtime.sendMessage(
        { type: "GET_STATE", triggerSync: Boolean(triggerSync) },
        (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return;
          window.postMessage(
            { type: "STUDYTRACKER_EXT_STATE", payload: res },
            window.location.origin
          );
        }
      );
    } catch {
      // Ignore invalidated extension context
    }
  }

  function pushTimerStatus(timerStatus, afterPush) {
    if (!isExtensionAlive()) return;
    try {
      chrome.runtime.sendMessage(
        { type: "SET_TIMER_STATUS", timerStatus },
        () => {
          if (chrome.runtime.lastError) return;
          if (afterPush) afterPush();
        }
      );
    } catch {
      // Ignore invalidated extension context
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data.type !== "string" || !isExtensionAlive()) return;

    if (data.type === "STUDYTRACKER_EXT_PING") {
      pushTimerStatus(readLocalTimerStatus(), () => forwardState(true));
      return;
    }

    if (data.type === "STUDYTRACKER_TIMER_STATUS") {
      pushTimerStatus(data.payload || readLocalTimerStatus(), () => forwardState(false));
      return;
    }

    if (data.type === "STUDYTRACKER_EXT_SET_CATEGORY" && data.domain && data.category) {
      try {
        chrome.runtime.sendMessage(
          {
            type: "SET_CATEGORY",
            domain: data.domain,
            category: data.category,
          },
          () => {
            if (chrome.runtime.lastError) return;
            forwardState(false);
          }
        );
      } catch {
        // Ignore invalidated extension context
      }
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "studyTimer") {
      pushTimerStatus(readLocalTimerStatus(), () => forwardState(false));
    }
  });

  // Sync timer status & initial browser usage when StudyTracker opens
  pushTimerStatus(readLocalTimerStatus(), () => forwardState(true));
})();
