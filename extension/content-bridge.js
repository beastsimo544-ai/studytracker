(() => {
  function isExtensionAlive() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
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

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data.type !== "string" || !isExtensionAlive()) return;

    if (data.type === "STUDYTRACKER_EXT_PING") {
      forwardState(true);
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

  // Push initial live browser usage when StudyTracker opens
  forwardState(true);
})();
