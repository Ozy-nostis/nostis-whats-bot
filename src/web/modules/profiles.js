import { state } from "./state.js";
import { escapeHtml } from "./utils.js";
import { refreshRules } from "./rules.js";
import { refreshCampaigns } from "./campaigns.js";
import { refreshGroups } from "./groups.js";

const profileSelect = document.getElementById("profile-select");
const manageProfilesBtn = document.getElementById("manage-profiles-btn");
const profilesModal = document.getElementById("profiles-modal");
const profilesListEl = document.getElementById("profiles-list");
const newProfileNameInput = document.getElementById("new-profile-name");
const newProfileCloneSelect = document.getElementById("new-profile-clone-from");
const createProfileBtn = document.getElementById("create-profile-btn");
const profilesCloseBtn = document.getElementById("profiles-close");

export async function refreshProfiles() {
  try {
    const r = await fetch("/profiles");
    const { profiles, activeId } = await r.json();
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
  const r = await fetch(`/profiles/${encodeURIComponent(id)}/activate`, { method: "POST" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    alert(data.error || "Não foi possível ativar o perfil.");
    renderProfileSelect();
    return;
  }
  state.activeProfileId = id;
  renderProfileSelect();
  await Promise.all([refreshRules(), refreshCampaigns(), refreshGroups()]);
}

export function renderProfilesList() {
  profilesListEl.innerHTML = state.allProfiles
    .map(
      (p) => `
      <li class="rule-item" data-id="${p.id}">
        <div class="rule-main">
          <div class="rule-keywords">${escapeHtml(p.name)} ${p.id === state.activeProfileId ? '<span class="tag-on">Ativo</span>' : ""}</div>
          <div class="rule-meta profile-import-row">
            <select class="import-source-select">
              <option value="">Importar de...</option>
              ${state.allProfiles
                .filter((o) => o.id !== p.id)
                .map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`)
                .join("")}
            </select>
            <button type="button" class="import-profile-btn secondary" data-id="${p.id}">Importar</button>
          </div>
        </div>
        <div class="rule-actions">
          ${p.id !== state.activeProfileId ? `<button class="activate-profile" data-id="${p.id}">Ativar</button>` : ""}
          <button class="rename-profile secondary" data-id="${p.id}">Renomear</button>
          <button class="delete-profile danger" data-id="${p.id}">Excluir</button>
        </div>
      </li>`
    )
    .join("");

  profilesListEl.querySelectorAll(".activate-profile").forEach((btn) => {
    btn.addEventListener("click", async () => {
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
      const li = btn.closest("li");
      const sourceId = li.querySelector(".import-source-select").value;
      if (!sourceId) return alert("Selecione de qual perfil importar.");
      importIntoProfile(btn.dataset.id, sourceId);
    });
  });
}

export function openProfilesModal() {
  renderProfilesList();
  newProfileNameInput.value = "";
  newProfileCloneSelect.innerHTML =
    `<option value="">Em branco</option>` +
    state.allProfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  profilesModal.classList.remove("hidden");
}

export async function renameProfile(id) {
  const profile = state.allProfiles.find((p) => p.id === id);
  const name = window.prompt("Novo nome do perfil:", profile ? profile.name : "");
  if (!name || !name.trim()) return;
  const r = await fetch(`/profiles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return alert(data.error || "Não foi possível renomear.");
  await refreshProfiles();
  renderProfilesList();
}

export async function deleteProfile(id) {
  const profile = state.allProfiles.find((p) => p.id === id);
  if (!confirm(`Excluir o perfil "${profile ? profile.name : ""}"? Isso apaga as regras, campanhas e grupos habilitados desse perfil.`)) {
    return;
  }
  const r = await fetch(`/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return alert(data.error || "Não foi possível excluir o perfil.");
  await refreshProfiles();
  renderProfilesList();
}

export async function importIntoProfile(targetId, sourceId) {
  const target = state.allProfiles.find((p) => p.id === targetId);
  const source = state.allProfiles.find((p) => p.id === sourceId);
  if (
    !confirm(
      `Importar os dados de "${source.name}" para "${target.name}"? Isso substitui as regras, campanhas e grupos atuais de "${target.name}".`
    )
  ) {
    return;
  }
  const r = await fetch(`/profiles/${encodeURIComponent(targetId)}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return alert(data.error || "Não foi possível importar.");
  if (targetId === state.activeProfileId) await Promise.all([refreshRules(), refreshCampaigns(), refreshGroups()]);
  alert("Importação concluída.");
}

export function initProfiles() {
  profileSelect.addEventListener("change", async () => {
    const id = profileSelect.value;
    if (id === state.activeProfileId) return;
    const profile = state.allProfiles.find((p) => p.id === id);
    if (!confirm(`Trocar para o perfil "${profile.name}"? Isso troca as regras, campanhas e grupos habilitados em uso agora.`)) {
      renderProfileSelect();
      return;
    }
    await activateProfile(id);
  });

  createProfileBtn.addEventListener("click", async () => {
    const name = newProfileNameInput.value.trim();
    if (!name) return alert("Informe um nome para o novo perfil.");
    const cloneFromId = newProfileCloneSelect.value || null;
    createProfileBtn.disabled = true;
    try {
      const r = await fetch("/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cloneFromId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Não foi possível criar o perfil.");
      await refreshProfiles();
      openProfilesModal();
    } catch (err) {
      alert(err.message);
    } finally {
      createProfileBtn.disabled = false;
    }
  });

  manageProfilesBtn.addEventListener("click", openProfilesModal);
  profilesCloseBtn.addEventListener("click", () => profilesModal.classList.add("hidden"));
  profilesModal.addEventListener("click", (e) => {
    if (e.target === profilesModal) profilesModal.classList.add("hidden");
  });
}
