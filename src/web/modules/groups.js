import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

const listEl = document.getElementById("groups-list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("groups-count");
const refreshGroupsBtn = document.getElementById("refresh-groups-btn");
const selectAllGroupsBtn = document.getElementById("select-all-groups-btn");
const deselectAllGroupsBtn = document.getElementById("deselect-all-groups-btn");

const campaignGroupSearch = document.getElementById("campaign-group-search");
const campaignGroupsListEl = document.getElementById("campaign-groups-list");
const campaignGroupsCountEl = document.getElementById("campaign-groups-count");

export function updateCount() {
  countEl.textContent = `${state.enabledSet.size} selecionado(s) de ${state.allGroups.length}`;
  selectAllGroupsBtn.disabled = state.allGroups.length === 0;
  deselectAllGroupsBtn.disabled = state.enabledSet.size === 0;
}

export function renderGroups(filter = "") {
  const f = filter.trim().toLowerCase();
  const visible = state.allGroups.filter(
    (g) => g.name.toLowerCase().includes(f) || g.jid.toLowerCase().includes(f)
  );

  if (visible.length === 0) {
    listEl.innerHTML = `<li class="empty">${
      state.allGroups.length === 0 ? "Nenhum grupo carregado" : "Nada encontrado"
    }</li>`;
    return;
  }

  listEl.innerHTML = visible
    .map((g) => {
      const avatar = g.hasPicture
        ? `<img class="group-avatar" src="/groups/picture/${encodeURIComponent(g.jid)}" alt="">`
        : `<div class="group-avatar placeholder">${escapeHtml((g.name[0] ?? "?").toUpperCase())}</div>`;
      const delay = state.groupDelays.get(g.jid) || 0;

      return `
      <li>
        <input type="number" class="group-delay-input" data-jid="${g.jid}" min="0" step="500" value="${delay}" title="Delay antes de responder nesse grupo (ms) — útil pra grupos que não deixam bot responder na hora">
        <input type="checkbox" data-jid="${g.jid}" ${state.enabledSet.has(g.jid) ? "checked" : ""}>
        ${avatar}
        <span class="group-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
      </li>`;
    })
    .join("");

  listEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const jid = e.target.dataset.jid;
      const enabled = e.target.checked;
      await fetch("/groups/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid, enabled }),
      });
      if (enabled) state.enabledSet.add(jid);
      else state.enabledSet.delete(jid);
      updateCount();
    });
  });

  listEl.querySelectorAll(".group-delay-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const jid = e.target.dataset.jid;
      const delayMs = Math.max(0, Number(e.target.value) || 0);
      e.target.value = delayMs;
      state.groupDelays.set(jid, delayMs);
      try {
        await fetch("/groups/delay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jid, delayMs }),
        });
      } catch (err) {
        console.error("Falha ao salvar delay do grupo:", err);
      }
    });
  });
}

export async function refreshGroups() {
  if (listEl.contains(document.activeElement)) return;
  try {
    const r = await fetch("/groups");
    const { groups, enabled, delays } = await r.json();
    state.allGroups = groups;
    state.enabledSet = new Set(enabled);
    state.groupDelays = new Map(Object.entries(delays || {}));
    renderGroups(searchEl.value);
    updateCount();
  } catch (err) {
    console.error("refreshGroups falhou:", err);
  }
}

export function renderCampaignGroupPicker(filter = "") {
  const f = filter.trim().toLowerCase();
  const visible = state.allGroups.filter(
    (g) => g.name.toLowerCase().includes(f) || g.jid.toLowerCase().includes(f)
  );

  if (visible.length === 0) {
    campaignGroupsListEl.innerHTML = `<li class="empty">${
      state.allGroups.length === 0 ? "Nenhum grupo carregado" : "Nada encontrado"
    }</li>`;
    return;
  }

  campaignGroupsListEl.innerHTML = visible
    .map((g) => {
      const avatar = g.hasPicture
        ? `<img class="group-avatar" src="/groups/picture/${encodeURIComponent(g.jid)}" alt="">`
        : `<div class="group-avatar placeholder">${escapeHtml((g.name[0] ?? "?").toUpperCase())}</div>`;

      return `
      <li>
        <input type="checkbox" data-jid="${g.jid}" ${state.campaignSelectedGroups.has(g.jid) ? "checked" : ""}>
        ${avatar}
        <span class="group-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
      </li>`;
    })
    .join("");

  campaignGroupsListEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const jid = e.target.dataset.jid;
      if (e.target.checked) state.campaignSelectedGroups.add(jid);
      else state.campaignSelectedGroups.delete(jid);
      campaignGroupsCountEl.textContent = `${state.campaignSelectedGroups.size} selecionado(s)`;
    });
  });
}

export function initGroups() {
  searchEl.addEventListener("input", () => renderGroups(searchEl.value));

  refreshGroupsBtn.addEventListener("click", async () => {
    refreshGroupsBtn.disabled = true;
    const originalLabel = refreshGroupsBtn.textContent;
    refreshGroupsBtn.textContent = "Atualizando...";
    try {
      const r = await fetch("/groups/refresh", { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Falha ao atualizar grupos (status ${r.status}).`);
      state.allGroups = data.groups;
      state.enabledSet = new Set(data.enabled);
      renderGroups(searchEl.value);
      updateCount();
    } catch (err) {
      console.error("refresh de grupos falhou:", err);
      alert(err.message);
    } finally {
      refreshGroupsBtn.disabled = false;
      refreshGroupsBtn.textContent = originalLabel;
    }
  });

  selectAllGroupsBtn.addEventListener("click", async () => {
    if (!confirm(`Selecionar todos os ${state.allGroups.length} grupos carregados?`)) return;

    selectAllGroupsBtn.disabled = true;
    try {
      const r = await fetch("/groups/select-all", { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Falha ao selecionar todos os grupos (status ${r.status}).`);
      state.allGroups = data.groups;
      state.enabledSet = new Set(data.enabled);
      renderGroups(searchEl.value);
      updateCount();
    } catch (err) {
      console.error("select-all falhou:", err);
      alert(err.message);
      updateCount();
    }
  });

  deselectAllGroupsBtn.addEventListener("click", async () => {
    if (!confirm(`Remover a seleção de todos os ${state.enabledSet.size} grupos habilitados?`)) return;

    deselectAllGroupsBtn.disabled = true;
    try {
      const r = await fetch("/groups/deselect-all", { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Falha ao desmarcar os grupos (status ${r.status}).`);
      state.allGroups = data.groups;
      state.enabledSet = new Set(data.enabled);
      renderGroups(searchEl.value);
      updateCount();
    } catch (err) {
      console.error("deselect-all falhou:", err);
      alert(err.message);
      updateCount();
    }
  });

  campaignGroupSearch.addEventListener("input", () => renderCampaignGroupPicker(campaignGroupSearch.value));
}
