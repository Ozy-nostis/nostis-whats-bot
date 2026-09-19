import { refreshStatus, initBotControls } from "./modules/bot.js";
import { refreshGroups, initGroups } from "./modules/groups.js";
import { refreshRules, initRules } from "./modules/rules.js";
import { refreshCampaigns, initCampaigns } from "./modules/campaigns.js";
import { initStickers } from "./modules/stickers.js";
import { refreshLeads, initMetrics } from "./modules/metrics.js";
import { refreshProfiles, initProfiles } from "./modules/profiles.js";
import { initSettings } from "./modules/settings.js";
import { initSidebarResizer } from "./modules/sidebar.js";

// Inicializa abas (Regras / Propaganda / Métricas)
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanels.forEach((p) => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
  });
});

// Inicializa módulos
initBotControls();
initGroups();
initRules();
initCampaigns();
initStickers();
initMetrics();
initProfiles();
initSettings();
initSidebarResizer();

// Carga inicial dos dados
refreshStatus();
refreshGroups();
refreshRules();
refreshCampaigns();
refreshLeads();
refreshProfiles();

// Polling em segundo plano
setInterval(refreshStatus, 2000);
setInterval(refreshGroups, 10000);
setInterval(refreshLeads, 15000);
