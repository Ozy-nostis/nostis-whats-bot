import { state } from "./state.js";
import { api } from "./api.js";
import { escapeHtml, phoneFromJid, avatarHtml } from "./utils.js";
import { refreshBans, unbanJid } from "./metrics.js";
import { icon, notify, bindModal, openModal, closeModal, setBusy, emptyState } from "./ui.js";

const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsIgnoreAdmInput = document.getElementById("settings-ignore-adm");
const settingsNoReplyNumbersInput = document.getElementById("settings-no-reply-numbers");
const settingsBansListEl = document.getElementById("settings-bans-list");
const settingsSaveBtn = document.getElementById("settings-save");

export function renderSettingsBansList() {
  if (state.allBans.length === 0) {
    settingsBansListEl.innerHTML = emptyState({
      iconName: "ban",
      title: "Nenhum número banido",
      text: "Quando você banir alguém pelas métricas, a pessoa aparece aqui.",
    });
    return;
  }

  settingsBansListEl.innerHTML = state.allBans
    .map((b) => {
      const name = b.name || phoneFromJid(b.jid);
      return `
      <li class="stack-item">
        <div class="stack-main">
          ${avatarHtml(name, { size: "sm" })}
          <div class="stack-text" style="gap:0">
            <strong>${escapeHtml(name)}</strong>
            <span class="sub">${escapeHtml(phoneFromJid(b.jid))}</span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm unban-btn" data-jid="${escapeHtml(b.jid)}">${icon("check")} Desbanir</button>
      </li>`;
    })
    .join("");

  settingsBansListEl.querySelectorAll(".unban-btn").forEach((btn) => {
    btn.addEventListener("click", () => unbanJid(btn.dataset.jid));
  });
}

export async function openSettingsModal() {
  try {
    const settings = await api("/settings");
    settingsIgnoreAdmInput.checked = settings.ignoreAdminNames;
    settingsNoReplyNumbersInput.value = settings.noReplyNumbers.join("\n");
  } catch (err) {
    console.error("openSettingsModal falhou:", err);
    notify.error(err.message, { title: "Não foi possível carregar as configurações" });
    return;
  }
  await refreshBans();
  renderSettingsBansList();
  openModal(settingsModal);
}

export async function saveSettings() {
  const ignoreAdminNames = settingsIgnoreAdmInput.checked;
  const noReplyNumbers = settingsNoReplyNumbersInput.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  setBusy(settingsSaveBtn, true, "Salvando…");
  try {
    await api("/settings", { method: "PUT", body: { ignoreAdminNames, noReplyNumbers } });
    closeModal(settingsModal);
    notify.success("As novas configurações já estão valendo.", { title: "Configurações salvas" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível salvar" });
  } finally {
    setBusy(settingsSaveBtn, false);
  }
}

export function initSettings() {
  settingsBtn.addEventListener("click", openSettingsModal);
  settingsSaveBtn.addEventListener("click", saveSettings);
  bindModal(settingsModal, () => closeModal(settingsModal));
}
