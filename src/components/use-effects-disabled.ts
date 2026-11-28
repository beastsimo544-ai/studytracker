"use client";

import { useSyncExternalStore } from "react";
import { loadEffectsDisabled } from "@/lib/profile-effects";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCustomEvent = () => onStoreChange();
  const handleStorageEvent = (event: StorageEvent) => {
    if (!event.key || event.key === "studytracker_effects_disabled") {
      onStoreChange();
    }
  };

  window.addEventListener("profile-effects-disabled-updated", handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(
      "profile-effects-disabled-updated",
      handleCustomEvent
    );
    window.removeEventListener("storage", handleStorageEvent);
  };
}

export function useEffectsDisabled(): boolean {
  return useSyncExternalStore(
    subscribe,
    loadEffectsDisabled,
    () => false
  );
}
