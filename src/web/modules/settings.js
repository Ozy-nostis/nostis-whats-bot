import { state } from "./state.js";
import { escapeHtml, phoneFromJid } from "./utils.js";
import { refreshBans, unbanJid } from "./metrics.js";

const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsIgnoreAdmInput = document.getElementById("settings-ignore-adm");
const settingsNoReplyNumbersInput = document.getElementById("settings-no-reply-numbers");
const settingsBansListEl = document.getElementById("settings-bans-list");
const settingsCancelBtn = document.getElementById("settings-cancel");
const settingsSaveBtn = document.getElementById("settings-save");

export function renderSettingsBansList() {
  if (state.allBans.length === 0) {
    settingsBansListEl.innerHTML = `<li class="empty">Nenhum número banido</li>`;
    return;
  }
  settingsBansListEl.innerHTML = state.allBans
    .map(
      (b) => `
      <li>
        <span>${escapeHtml(b.name || phoneFromJid(b.jid))} — ${phoneFromJid(b.jid)}</span>
        <button type="button" class="unban-btn secondary" data-jid="${b.jid}">Desbanir</button>
      </li>`
    )
    .join("");
  settingsBansListEl.querySelectorAll(".unban-btn").forEach((btn) => {
    btn.addEventListener("click", () => unbanJid(btn.dataset.jid));
  });
}

export async function openSettingsModal() {
  try {
    const r = await fetch("/settings");
    const settings = await r.json();
    settingsIgnoreAdmInput.checked = settings.ignoreAdminNames;
    settingsNoReplyNumbersInput.value = settings.noReplyNumbers.join("\n");
  } catch (err) {
    console.error("openSettingsModal falhou:", err);
  }
  await refreshBans();
  renderSettingsBansList();
  settingsModal.classList.remove("hidden");
}

export async function saveSettings() {
  const ignoreAdminNames = settingsIgnoreAdmInput.checked;
  const noReplyNumbers = settingsNoReplyNumbersInput.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  settingsSaveBtn.disabled = true;
  try {
    const r = await fetch("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignoreAdminNames, noReplyNumbers }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Não foi possível salvar as configurações.");
    settingsModal.classList.add("hidden");
  } catch (err) {
    alert(err.message);
  } finally {
    settingsSaveBtn.disabled = false;
  }
}

export function initSettings() {
  settingsBtn.addEventListener("click", openSettingsModal);
  settingsCancelBtn.addEventListener("click", () => settingsModal.classList.add("hidden"));
  settingsSaveBtn.addEventListener("click", saveSettings);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.add("hidden");
  });
}
