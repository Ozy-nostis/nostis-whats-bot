const SIDEBAR_WIDTH_KEY = "brinzy-sidebar-width";
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 640;

const panelResizer = document.getElementById("panel-resizer");

export function applySidebarWidth(width) {
  const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
  document.documentElement.style.setProperty("--sidebar-width", `${clamped}px`);
  return clamped;
}

export function initSidebarResizer() {
  try {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (saved) applySidebarWidth(saved);
  } catch {
    // localStorage indisponível (navegação anônima)
  }

  let dragging = false;

  panelResizer.addEventListener("mousedown", (e) => {
    dragging = true;
    panelResizer.classList.add("dragging");
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    applySidebarWidth(e.clientX);
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    panelResizer.classList.remove("dragging");
    try {
      const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"), 10);
      if (current) localStorage.setItem(SIDEBAR_WIDTH_KEY, String(current));
    } catch {
      // ignore
    }
  });
}
