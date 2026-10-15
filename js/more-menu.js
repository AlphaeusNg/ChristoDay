/** Day-card overflow menu for checklist print and calendar download. */
(function () {
  "use strict";

  function bind() {
    const root = document.getElementById("more-menu");
    const button = document.getElementById("btn-more");
    const menu = document.getElementById("more-menu-list");
    if (!root || !button || !menu) return;

    const panels = ["reading-panel", "weekend-panel", "before-panel"]
      .map((id) => document.getElementById(id));
    const statuses = ["checklist-status", "calendar-status"]
      .map((id) => document.getElementById(id));

    function placeMenu() {
      const panel = panels.find((panel) => !panel.hidden);
      if (!panel) return;
      const anchor = panel.querySelector(".card-head") || panel;
      if (root.parentElement === anchor) return;
      close(false);
      anchor.append(root);
      const heading = panel.querySelector(".card-head, h2");
      heading.after(...statuses);
    }
    const observer = new MutationObserver(placeMenu);
    panels.forEach((panel) => observer.observe(panel, {
      attributes: true, attributeFilter: ["hidden"],
    }));
    placeMenu();

    const items = () =>
      [...menu.querySelectorAll('[role="menuitem"]')].filter((item) => !item.disabled);

    function isOpen() {
      return button.getAttribute("aria-expanded") === "true";
    }

    function open() {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
    }

    function close(restoreFocus) {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (restoreFocus) button.focus();
    }

    button.addEventListener("click", () => {
      if (isOpen()) close(false);
      else open();
    });

    // Capture runs before the menuitem's own click handler, so the menu closes first.
    menu.addEventListener("click", (event) => {
      const item = event.target.closest?.('[role="menuitem"]');
      if (!item || !menu.contains(item) || item.disabled) return;
      close(false);
    }, true);

    document.addEventListener("click", (event) => {
      if (!isOpen() || root.contains(event.target)) return;
      close(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!isOpen()) return;
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const fromButton = document.activeElement === button;
      if (!isOpen()) {
        if (!fromButton) return;
        open();
      }
      if (!fromButton && !menu.contains(document.activeElement)) return;
      const list = items();
      if (!list.length) return;
      event.preventDefault();
      const index = list.indexOf(document.activeElement);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = index === -1
        ? (delta > 0 ? list[0] : list[list.length - 1])
        : list[(index + delta + list.length) % list.length];
      next.focus();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
