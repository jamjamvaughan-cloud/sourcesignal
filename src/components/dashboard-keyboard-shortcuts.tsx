"use client";

import * as React from "react";

export function DashboardKeyboardShortcuts() {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // / — Search (focus search input)
      if (event.key === "/") {
        event.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder*="Search"], input[id="search"]',
        ) as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // J — Next opportunity
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        const nextBtn = document.querySelector(
          '[aria-label="Next opportunity"], [data-next-opportunity]',
        ) as HTMLElement | null;
        if (nextBtn) {
          nextBtn.click();
        }
      }

      // K — Previous opportunity
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        const prevBtn = document.querySelector(
          '[aria-label="Previous opportunity"], [data-prev-opportunity]',
        ) as HTMLElement | null;
        if (prevBtn) {
          prevBtn.click();
        }
      }

      // S — Save current opportunity
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        const saveBtn = document.querySelector(
          '[aria-label="Save opportunity"], [data-save-opportunity]',
        ) as HTMLElement | null;
        if (saveBtn) {
          saveBtn.click();
        }
      }

      // E — Export
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        const exportBtn = document.querySelector(
          '[aria-label="Export"], [data-export]',
        ) as HTMLElement | null;
        if (exportBtn) {
          exportBtn.click();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
