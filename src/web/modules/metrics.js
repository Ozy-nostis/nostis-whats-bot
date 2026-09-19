import { state } from "./state.js";
import { escapeHtml, formatDateTime, phoneFromJid, callerBadgeHtml } from "./utils.js";
import { renderSettingsBansList } from "./settings.js";

const metricsSearchEl = document.getElementById("metrics-search");
const metricsSummaryEl = document.getElementById("metrics-summary");
const metricsTbodyEl = document.getElementById("metrics-tbody");
const metricsPaginationEl = document.getElementById("metrics-pagination");
const settingsModal = document.getElementById("settings-modal");

export function renderMetricsSummary(leads) {
  const total = leads.length;
  const calledPrivately = leads.filter((l) => l.privateContactAt).length;
  const closed = leads.filter((l) => l.status === "closed");
  const conversionPct = total > 0 ? Math.round((calledPrivately / total) * 100) : 0;
  const revenue = closed.reduce((sum, l) => sum + (l.value || 0), 0);

  metricsSummaryEl.innerHTML = `
    <div class="metric-card"><span class="metric-value">${total}</span><span class="metric-label">Gatilhos disparados</span></div>
    <div class="metric-card"><span class="metric-value">${calledPrivately}</span><span class="metric-label">Chamaram no privado (${conversionPct}%)</span></div>
    <div class="metric-card"><span class="metric-value">${closed.length}</span><span class="metric-label">Corridas fechadas</span></div>
    <div class="metric-card"><span class="metric-value">R$ ${revenue.toFixed(2)}</span><span class="metric-label">Faturamento (fechadas)</span></div>
  `;
}

export function renderMetricsTable(filter = "") {
  const f = filter.trim().toLowerCase();
  const visible = state.allLeads.filter(
    (l) =>
      l.groupName.toLowerCase().includes(f) ||
      (l.callerName || "").toLowerCase().includes(f) ||
      phoneFromJid(l.callerJid).includes(f)
  );

  renderMetricsSummary(state.allLeads);

  if (visible.length === 0) {
    metricsTbodyEl.innerHTML = `<tr><td colspan="7" class="empty">${
      state.allLeads.length === 0
        ? "Nenhum gatilho rastreado ainda. Ative \"Rastrear métricas\" numa regra pra começar."
        : "Nada encontrado."
    }</td></tr>`;
    renderMetricsPagination(0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(visible.length / state.metricsPageSize));
  if (state.metricsPage > totalPages) state.metricsPage = totalPages;
  if (state.metricsPage < 1) state.metricsPage = 1;
  const pageItems = visible.slice(
    (state.metricsPage - 1) * state.metricsPageSize,
    state.metricsPage * state.metricsPageSize
  );

  const bannedSet = new Set(state.allBans.map((b) => b.jid));
  const callerCountByJid = new Map(state.allCallers.map((c) => [c.jid, c.count]));

  metricsTbodyEl.innerHTML = pageItems
    .map((l) => {
      const isBanned = bannedSet.has(l.callerJid);
      const callCount = callerCountByJid.get(l.callerJid) || 0;
      const person = `${escapeHtml(l.callerName || phoneFromJid(l.callerJid))}${
        isBanned ? ' <span class="tag-off">Banido</span>' : ""
      }${callerBadgeHtml(callCount)}`;
      const privateContact = l.privateContactAt
        ? formatDateTime(l.privateContactAt)
        : `<span class="tag-off">Ainda não</span>`;
      const banBtn = isBanned
        ? `<button class="unban-lead secondary" data-jid="${l.callerJid}">Desbanir</button>`
        : `<button class="ban-lead danger" data-id="${l.id}">🚫 Banir</button>`;

      return `
      <tr data-id="${l.id}">
        <td>${escapeHtml(l.groupName)}</td>
        <td>${person}</td>
        <td>${formatDateTime(l.triggeredAt)}</td>
        <td>${privateContact}</td>
        <td><input type="number" class="lead-value" min="0" step="0.01" value="${l.value ?? ""}" placeholder="0,00"></td>
        <td>
          <select class="lead-status">
            <option value="pending" ${l.status === "pending" ? "selected" : ""}>Pendente</option>
            <option value="closed" ${l.status === "closed" ? "selected" : ""}>Fechou</option>
            <option value="not_closed" ${l.status === "not_closed" ? "selected" : ""}>Não fechou</option>
          </select>
        </td>
        <td>${banBtn}<button class="delete-lead danger" data-id="${l.id}">Excluir</button></td>
      </tr>`;
    })
    .join("");

  metricsTbodyEl.querySelectorAll(".lead-value").forEach((input) => {
    input.addEventListener("change", (e) => {
      const id = e.target.closest("tr").dataset.id;
      const value = e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0);
      updateLead(id, { value });
    });
  });
  metricsTbodyEl.querySelectorAll(".lead-status").forEach((select) => {
    select.addEventListener("change", (e) => {
      const id = e.target.closest("tr").dataset.id;
      updateLead(id, { status: e.target.value });
    });
  });
  metricsTbodyEl.querySelectorAll(".delete-lead").forEach((btn) => {
    btn.addEventListener("click", () => deleteLead(btn.dataset.id));
  });
  metricsTbodyEl.querySelectorAll(".ban-lead").forEach((btn) => {
    btn.addEventListener("click", () => banLead(btn.dataset.id));
  });
  metricsTbodyEl.querySelectorAll(".unban-lead").forEach((btn) => {
    btn.addEventListener("click", () => unbanJid(btn.dataset.jid));
  });

  renderMetricsPagination(visible.length);
}

export function renderMetricsPagination(totalItems) {
  if (totalItems === 0) {
    metricsPaginationEl.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / state.metricsPageSize));

  metricsPaginationEl.innerHTML = `
    <button id="metrics-prev-page" class="secondary" ${state.metricsPage <= 1 ? "disabled" : ""}>‹ Anterior</button>
    <span>Página ${state.metricsPage} de ${totalPages} (${totalItems} registro${totalItems === 1 ? "" : "s"})</span>
    <button id="metrics-next-page" class="secondary" ${state.metricsPage >= totalPages ? "disabled" : ""}>Próxima ›</button>
  `;

  document.getElementById("metrics-prev-page").addEventListener("click", () => {
    if (state.metricsPage <= 1) return;
    state.metricsPage -= 1;
    renderMetricsTable(metricsSearchEl.value);
  });
  document.getElementById("metrics-next-page").addEventListener("click", () => {
    if (state.metricsPage >= totalPages) return;
    state.metricsPage += 1;
    renderMetricsTable(metricsSearchEl.value);
  });
}

export async function banLead(id) {
  const lead = state.allLeads.find((l) => l.id === id);
  if (!lead) return;
  const label = lead.callerName || phoneFromJid(lead.callerJid);
  if (
    !confirm(
      `Banir ${label}? O bot vai ignorar essa pessoa nos grupos e avisar se ela chamar no privado.`
    )
  ) {
    return;
  }
  const r = await fetch(`/leads/${encodeURIComponent(id)}/ban`, { method: "POST" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    alert(data.error || "Não foi possível banir.");
    return;
  }
  await refreshBans();
  renderMetricsTable(metricsSearchEl.value);
}

export async function unbanJid(jid) {
  if (!confirm("Remover o banimento desse número?")) return;
  await fetch(`/bans/${encodeURIComponent(jid)}`, { method: "DELETE" });
  await refreshBans();
  renderMetricsTable(metricsSearchEl.value);
  if (!settingsModal.classList.contains("hidden")) renderSettingsBansList();
}

export async function refreshBans() {
  try {
    const r = await fetch("/bans");
    const { bans } = await r.json();
    state.allBans = bans;
  } catch (err) {
    console.error("refreshBans falhou:", err);
  }
}

export async function refreshCallers() {
  try {
    const r = await fetch("/callers");
    const { callers } = await r.json();
    state.allCallers = callers;
  } catch (err) {
    console.error("refreshCallers falhou:", err);
  }
}

export async function updateLead(id, patch) {
  try {
    const r = await fetch(`/leads/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Não foi possível salvar.");

    const lead = state.allLeads.find((l) => l.id === id);
    if (lead) Object.assign(lead, data.lead);
    renderMetricsSummary(state.allLeads);
  } catch (err) {
    console.error("updateLead falhou:", err);
    alert(err.message);
    refreshLeads();
  }
}

export async function deleteLead(id) {
  if (!confirm("Excluir este registro de métricas?")) return;
  await fetch(`/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
  state.allLeads = state.allLeads.filter((l) => l.id !== id);
  renderMetricsTable(metricsSearchEl.value);
}

export async function refreshLeads() {
  if (metricsTbodyEl.contains(document.activeElement)) return;
  try {
    const r = await fetch("/leads");
    const { leads } = await r.json();
    state.allLeads = leads;
    await Promise.all([refreshBans(), refreshCallers()]);
    renderMetricsTable(metricsSearchEl.value);
  } catch (err) {
    console.error("refreshLeads falhou:", err);
  }
}

export function initMetrics() {
  metricsSearchEl.addEventListener("input", () => {
    state.metricsPage = 1;
    renderMetricsTable(metricsSearchEl.value);
  });
}
