import { refreshStatus, initBotControls } from "./modules/bot.js";
import { refreshGroups, initGroups } from "./modules/groups.js";
import { refreshRules, initRules } from "./modules/rules.js";
import { refreshCampaigns, initCampaigns } from "./modules/campaigns.js";
import { initStickers } from "./modules/stickers.js";
import { refreshLeads, initMetrics } from "./modules/metrics.js";
import { refreshProfiles, initProfiles } from "./modules/profiles.js";
import { initSettings } from "./modules/settings.js";
import { initSidebarResizer } from "./modules/sidebar.js";

/* ---------- Abas (Regras / Propaganda / Métricas) ---------- */

const TAB_KEY = "brinzy-active-tab";
const tabsEl = document.querySelector(".tabs");
const tabIndicator = document.querySelector(".tab-indicator");
const tabBtns = [...document.querySelectorAll(".tab-btn")];
const tabPanels = document.querySelectorAll(".tab-panel");

function moveTabIndicator() {
  const active = tabBtns.find((b) => b.classList.contains("active"));
  if (!active) return;
  tabIndicator.style.width = `${active.offsetWidth}px`;
  tabIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function selectTab(btn, { focus = false } = {}) {
  tabBtns.forEach((b) => {
    const isActive = b === btn;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", String(isActive));
    b.tabIndex = isActive ? 0 : -1;
  });
  tabPanels.forEach((p) => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
  moveTabIndicator();
  btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (focus) btn.focus();
  try {
    localStorage.setItem(TAB_KEY, btn.dataset.tab);
  } catch {
    // localStorage indisponível
  }
}

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => selectTab(btn));
});

// Setas esquerda/direita, Home e End navegam entre as abas (padrão WAI-ARIA)
tabsEl.addEventListener("keydown", (e) => {
  const idx = tabBtns.indexOf(document.activeElement);
  if (idx === -1) return;
  let next = null;
  if (e.key === "ArrowRight") next = tabBtns[(idx + 1) % tabBtns.length];
  else if (e.key === "ArrowLeft") next = tabBtns[(idx - 1 + tabBtns.length) % tabBtns.length];
  else if (e.key === "Home") next = tabBtns[0];
  else if (e.key === "End") next = tabBtns[tabBtns.length - 1];
  if (!next) return;
  e.preventDefault();
  selectTab(next, { focus: true });
});

let savedTab = null;
try {
  savedTab = localStorage.getItem(TAB_KEY);
} catch {
  // localStorage indisponível
}
selectTab(tabBtns.find((b) => b.dataset.tab === savedTab) ?? tabBtns[0]);
window.addEventListener("resize", moveTabIndicator);
if (document.fonts?.ready) document.fonts.ready.then(moveTabIndicator);
// Os contadores das abas mudam de largura depois do carregamento inicial
new ResizeObserver(moveTabIndicator).observe(tabsEl);

/* ---------- Módulos ---------- */

initBotControls();
initGroups();
initRules();
initCampaigns();
initStickers();
initMetrics();
initProfiles();
initSettings();
initSidebarResizer();

/* ---------- Carga inicial ---------- */

refreshStatus();
refreshGroups();
refreshRules();
refreshCampaigns();
refreshLeads();
refreshProfiles();

/* ---------- Polling em segundo plano (pausa com a aba escondida) ---------- */

function every(ms, fn) {
  setInterval(() => {
    if (!document.hidden) fn();
  }, ms);
}

every(2000, refreshStatus);
every(10000, refreshGroups);
every(15000, refreshLeads);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshStatus();
    refreshGroups();
    refreshLeads();
  }
});
