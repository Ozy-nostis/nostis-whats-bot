import { state } from "./state.js";
import { api } from "./api.js";
import { escapeHtml, avatarHtml } from "./utils.js";
import { refreshRules } from "./rules.js";
import { refreshCampaigns } from "./campaigns.js";
import { refreshGroups } from "./groups.js";
import {
  icon,
  notify,
  confirmDialog,
  promptDialog,
  bindModal,
  openModal,
  closeModal,
  flagInvalid,
  setBusy,
} from "./ui.js";

const profileSelect = document.getElementById("profile-select");
const manageProfilesBtn = document.getElementById("manage-profiles-btn");
const profilesModal = document.getElementById("profiles-modal");
const profilesListEl = document.getElementById("profiles-list");
const newProfileNameInput = document.getElementById("new-profile-name");
const newProfileCloneSelect = document.getElementById("new-profile-clone-from");
const createProfileBtn = document.getElementById("create-profile-btn");

export async function refreshProfiles() {
  try {
    const { profiles, activeId } = await api("/profiles");
    state.allProfiles = profiles;
    state.activeProfileId = activeId;
    renderProfileSelect();
  } catch (err) {
    console.error("refreshProfiles falhou:", err);
  }
}

export function renderProfileSelect() {
  profileSelect.innerHTML = state.allProfiles
    .map((p) => `<option value="${p.id}" ${p.id === state.activeProfileId ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
    .join("");
}

export async function activateProfile(id) {
  try {
    await api(`/profiles/${encodeURIComponent(id)}/activate`, { method: "POST" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível ativar o perfil" });
    renderProfileSelect();
    return false;
  }

  state.activeProfileId = id;
  renderProfileSelect();
  await Promise.all([refreshRules(), refreshCampaigns(), refreshGroups()]);
  const profile = state.allProfiles.find((p) => p.id === id);
  notify.success("Regras, campanhas e grupos foram trocados.", { title: `Perfil “${profile ? profile.name : ""}” ativo` });
  return true;
}

function profileOptions(exceptId) {
  return state.allProfiles
    .filter((o) => o.id !== exceptId)
    .map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`)
    .join("");
}

export function renderProfilesList() {
  profilesListEl.innerHTML = state.allProfiles
    .map((p) => {
      const isActive = p.id === state.activeProfileId;
      const others = profileOptions(p.id);
      return `
      <li class="stack-item ${isActive ? "is-active" : ""}" data-id="${p.id}">
        <div class="stack-main">
          ${avatarHtml(p.name, { size: "lg" })}
          <div class="stack-text">
            <strong>${escapeHtml(p.name)} ${isActive ? '<span class="badge badge-success">Ativo</span>' : ""}</strong>
            ${
              others
                ? `<div class="import-row">
                     <select class="select import-source-select" aria-label="Importar de outro perfil">
                       <option value="">Importar de…</option>${others}
                     </select>
                     <button type="button" class="btn btn-secondary btn-sm import-profile-btn" data-id="${p.id}">Importar</button>
                   </div>`
                : ""
            }
          </div>
        </div>
        <div class="card-actions">
          ${isActive ? "" : `<button type="button" class="btn btn-primary btn-sm activate-profile" data-id="${p.id}">Ativar</button>`}
          <button type="button" class="icon-btn icon-btn-sm rename-profile" data-id="${p.id}" title="Renomear perfil" aria-label="Renomear perfil">${icon("pencil")}</button>
          <button type="button" class="icon-btn icon-btn-sm danger delete-profile" data-id="${p.id}" title="Excluir perfil" aria-label="Excluir perfil">${icon("trash")}</button>
        </div>
      </li>`;
    })
    .join("");

  profilesListEl.querySelectorAll(".activate-profile").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await activateProfile(btn.dataset.id);
      renderProfilesList();
    });
  });
  profilesListEl.querySelectorAll(".rename-profile").forEach((btn) => {
    btn.addEventListener("click", () => renameProfile(btn.dataset.id));
  });
  profilesListEl.querySelectorAll(".delete-profile").forEach((btn) => {
    btn.addEventListener("click", () => deleteProfile(btn.dataset.id));
  });
  profilesListEl.querySelectorAll(".import-profile-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const select = btn.closest("li").querySelector(".import-source-select");
      if (!select.value) return notify.warning("Escolha de qual perfil importar.", { title: "Nenhum perfil selecionado" });
      importIntoProfile(btn.dataset.id, select.value);
    });
  });
}

export function openProfilesModal() {
  renderProfilesList();
  newProfileNameInput.value = "";
  newProfileNameInput.classList.remove("is-invalid");
  newProfileCloneSelect.innerHTML =
    `<option value="">Em branco</option>` +
    state.allProfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  openModal(profilesModal);
}

export async function renameProfile(id) {
  const profile = state.allProfiles.find((p) => p.id === id);
  const name = await promptDialog({
    title: "Renomear perfil",
    label: "Novo nome do perfil",
    value: profile ? profile.name : "",
    confirmText: "Renomear",
  });
  if (!name) return;

  try {
    await api(`/profiles/${encodeURIComponent(id)}`, { method: "PUT", body: { name } });
    await refreshProfiles();
    renderProfilesList();
    notify.success(`O perfil agora se chama “${name}”.`, { title: "Perfil renomeado" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível renomear" });
  }
}

export async function deleteProfile(id) {
  const profile = state.allProfiles.find((p) => p.id === id);
  const confirmed = await confirmDialog({
    title: `Excluir o perfil “${profile ? profile.name : ""}”?`,
    message: "Isso apaga as regras, campanhas e grupos habilitados desse perfil. Essa ação não pode ser desfeita.",
    confirmText: "Excluir perfil",
    tone: "danger",
  });
  if (!confirmed) return;

  try {
    await api(`/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshProfiles();
    renderProfilesList();
    notify.success("O perfil foi removido.", { title: "Perfil excluído" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível excluir o perfil" });
  }
}

export async function importIntoProfile(targetId, sourceId) {
  const target = state.allProfiles.find((p) => p.id === targetId);
  const source = state.allProfiles.find((p) => p.id === sourceId);
  const confirmed = await confirmDialog({
    title: "Importar dados de outro perfil?",
    message: `As regras, campanhas e grupos de “${source.name}” vão substituir os atuais de “${target.name}”.`,
    confirmText: "Importar",
    tone: "danger",
  });
  if (!confirmed) return;

  try {
    await api(`/profiles/${encodeURIComponent(targetId)}/import`, { method: "POST", body: { sourceId } });
    if (targetId === state.activeProfileId) await Promise.all([refreshRules(), refreshCampaigns(), refreshGroups()]);
    notify.success(`Os dados de “${source.name}” foram copiados para “${target.name}”.`, { title: "Importação concluída" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível importar" });
  }
}

async function createProfile() {
  const name = newProfileNameInput.value.trim();
  if (!name) return flagInvalid(newProfileNameInput, "Informe um nome para o novo perfil.");
  const cloneFromId = newProfileCloneSelect.value || null;

  setBusy(createProfileBtn, true, "Criando…");
  try {
    await api("/profiles", { method: "POST", body: { name, cloneFromId } });
    await refreshProfiles();
    openProfilesModal(); // recarrega a lista e limpa o formulário
    newProfileNameInput.focus();
    notify.success(`O perfil “${name}” está pronto.`, { title: "Perfil criado" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível criar o perfil" });
  } finally {
    setBusy(createProfileBtn, false);
  }
}

export function initProfiles() {
  profileSelect.addEventListener("change", async () => {
    const id = profileSelect.value;
    if (id === state.activeProfileId) return;
    const profile = state.allProfiles.find((p) => p.id === id);

    const confirmed = await confirmDialog({
      title: `Trocar para “${profile.name}”?`,
      message: "Isso troca as regras, campanhas e grupos habilitados em uso agora.",
      confirmText: "Trocar perfil",
    });
    if (!confirmed) {
      renderProfileSelect();
      return;
    }
    await activateProfile(id);
  });

  createProfileBtn.addEventListener("click", createProfile);
  newProfileNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      createProfile();
    }
  });

  manageProfilesBtn.addEventListener("click", openProfilesModal);
  bindModal(profilesModal, () => closeModal(profilesModal));
}
