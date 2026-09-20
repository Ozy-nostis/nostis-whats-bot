import { state } from "./state.js";
import { api } from "./api.js";
import { escapeHtml, formatDateTime, formatCurrency, phoneFromJid, callerBadgeHtml, avatarHtml } from "./utils.js";
import { renderSettingsBansList } from "./settings.js";
import { icon, notify, confirmDialog, isModalOpen, setTabCount } from "./ui.js";

const metricsSearchEl = document.getElementById("metrics-search");
const metricsTbodyEl = document.getElementById("metrics-tbody");
const metricsPaginationEl = document.getElementById("metrics-pagination");
const settingsModal = document.getElementById("settings-modal");

const statTotalEl = document.getElementById("stat-total");
const statPrivateEl = document.getElementById("stat-private");
const statPrivateLabelEl = document.getElementById("stat-private-label");
const statClosedEl = document.getElementById("stat-closed");
const statRevenueEl = document.getElementById("stat-revenue");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Atualiza um número do resumo com uma contagem animada (só quando o valor muda). */
function setStat(el, value, format = (n) => String(Math.round(n))) {
  const from = Number(el.dataset.value ?? 0);
  if (from === value && el.dataset.value !== undefined) return;
  el.dataset.value = String(value);

  if (reduceMotion.matches || from === value) {
    el.textContent = format(value);
    return;
  }

  const start = performance.now();
  const duration = 520;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (value - from) * eased);
    if (t < 1 && Number(el.dataset.value) === value) requestAnimationFrame(step);
    else el.textContent = format(Number(el.dataset.value));
  };
  requestAnimationFrame(step);
}

export function renderMetricsSummary(leads) {
  const total = leads.length;
  const calledPrivately = leads.filter((l) => l.privateContactAt).length;
  const closed = leads.filter((l) => l.status === "closed");
  const conversionPct = total > 0 ? Math.round((calledPrivately / total) * 100) : 0;
  const revenue = closed.reduce((sum, l) => sum + (l.value || 0), 0);

  setStat(statTotalEl, total);
  setStat(statPrivateEl, calledPrivately);
  statPrivateLabelEl.textContent = `Chamaram no privado · ${conversionPct}%`;
  setStat(statClosedEl, closed.length);
  setStat(statRevenueEl, revenue, formatCurrency);
}

function emptyRow(title, text) {
  return `
    <tr><td colspan="7">
      <div class="empty-state">
        <span class="empty-icon">${icon("chart")}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </div>
    </td></tr>`;
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
  setTabCount("metrics-count", state.allLeads.length);

  if (visible.length === 0) {
    metricsTbodyEl.innerHTML =
      state.allLeads.length === 0
        ? emptyRow("Nenhum gatilho rastreado ainda", "Ative “Rastrear métricas” em uma regra para começar a acompanhar quem chama.")
        : emptyRow("Nada encontrado", "Nenhum registro corresponde ao filtro digitado.");
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
      const name = l.callerName || phoneFromJid(l.callerJid);
      const person = `
        <div class="person">
          ${avatarHtml(name, { size: "sm" })}
          <div>
            <div class="person-name">${escapeHtml(name)}</div>
            <div class="person-sub"><span>${escapeHtml(phoneFromJid(l.callerJid))}</span>${isBanned ? '<span class="badge badge-danger">Banido</span>' : ""}${callerBadgeHtml(callCount)}</div>
          </div>
        </div>`;
      const privateContact = l.privateContactAt
        ? `<span class="when">${icon("check")} ${formatDateTime(l.privateContactAt)}</span>`
        : `<span class="chip-muted">${icon("clock")} Ainda não</span>`;
      const banBtn = isBanned
        ? `<button type="button" class="icon-btn icon-btn-sm is-banned unban-lead" data-jid="${escapeHtml(l.callerJid)}" title="Pessoa banida — clique para desbanir" aria-label="Desbanir esta pessoa">${icon("ban")}</button>`
        : `<button type="button" class="icon-btn icon-btn-sm ghost danger ban-lead" data-id="${l.id}" title="Banir esta pessoa" aria-label="Banir esta pessoa">${icon("ban")}</button>`;

      return `
      <tr data-id="${l.id}">
        <td class="wrap">${escapeHtml(l.groupName)}</td>
        <td>${person}</td>
        <td>${formatDateTime(l.triggeredAt)}</td>
        <td>${privateContact}</td>
        <td>
          <span class="money"><span>R$</span><input type="number" class="input lead-value" min="0" step="0.01" value="${l.value ?? ""}" placeholder="0,00" aria-label="Valor da corrida"></span>
        </td>
        <td>
          <select class="select lead-status" data-status="${l.status}" aria-label="Status">
            <option value="pending" ${l.status === "pending" ? "selected" : ""}>Pendente</option>
            <option value="closed" ${l.status === "closed" ? "selected" : ""}>Fechou</option>
            <option value="not_closed" ${l.status === "not_closed" ? "selected" : ""}>Não fechou</option>
          </select>
        </td>
        <td>
          <div class="row-actions">
            ${banBtn}
            <button type="button" class="icon-btn icon-btn-sm ghost danger delete-lead" data-id="${l.id}" title="Excluir registro" aria-label="Excluir registro">${icon("trash")}</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  metricsTbodyEl.querySelectorAll(".lead-value").forEach((input) => {
    input.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      const value = e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0);
      updateLead(tr.dataset.id, { value }, tr);
    });
  });
  metricsTbodyEl.querySelectorAll(".lead-status").forEach((select) => {
    select.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      e.target.dataset.status = e.target.value;
      updateLead(tr.dataset.id, { status: e.target.value }, tr);
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
    <button id="metrics-prev-page" type="button" class="btn btn-sm" ${state.metricsPage <= 1 ? "disabled" : ""}>${icon("chevron-left")} Anterior</button>
    <span class="page-info">Página ${state.metricsPage} de ${totalPages} · ${totalItems} registro${totalItems === 1 ? "" : "s"}</span>
    <button id="metrics-next-page" type="button" class="btn btn-sm" ${state.metricsPage >= totalPages ? "disabled" : ""}>Próxima ${icon("chevron-right")}</button>
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

  const confirmed = await confirmDialog({
    title: `Banir ${label}?`,
    message: "O bot vai ignorar essa pessoa nos grupos e avisar se ela chamar no privado.",
    confirmText: "Banir",
    tone: "danger",
  });
  if (!confirmed) return;

  try {
    await api(`/leads/${encodeURIComponent(id)}/ban`, { method: "POST" });
    await refreshBans();
    renderMetricsTable(metricsSearchEl.value);
    notify.success(`${label} não será mais respondido pelo bot.`, { title: "Pessoa banida" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível banir" });
  }
}

export async function unbanJid(jid) {
  const confirmed = await confirmDialog({
    title: "Remover o banimento?",
    message: "O bot volta a responder esse número normalmente.",
    confirmText: "Desbanir",
  });
  if (!confirmed) return;

  try {
    await api(`/bans/${encodeURIComponent(jid)}`, { method: "DELETE" });
    await refreshBans();
    renderMetricsTable(metricsSearchEl.value);
    if (isModalOpen(settingsModal)) renderSettingsBansList();
    notify.success("O número foi desbanido.", { title: "Banimento removido" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível desbanir" });
  }
}

export async function refreshBans() {
  try {
    const { bans } = await api("/bans");
    state.allBans = bans;
  } catch (err) {
    console.error("refreshBans falhou:", err);
  }
}

export async function refreshCallers() {
  try {
    const { callers } = await api("/callers");
    state.allCallers = callers;
  } catch (err) {
    console.error("refreshCallers falhou:", err);
  }
}

export async function updateLead(id, patch, row) {
  try {
    const data = await api(`/leads/${encodeURIComponent(id)}`, { method: "PUT", body: patch });

    const lead = state.allLeads.find((l) => l.id === id);
    if (lead) Object.assign(lead, data.lead);
    renderMetricsSummary(state.allLeads);

    if (row) {
      row.classList.remove("row-flash");
      void row.offsetWidth;
      row.classList.add("row-flash");
    }
    notify.success("Registro atualizado.", { duration: 1800 });
  } catch (err) {
    console.error("updateLead falhou:", err);
    notify.error(err.message, { title: "Não foi possível salvar" });
    refreshLeads();
  }
}

export async function deleteLead(id) {
  const confirmed = await confirmDialog({
    title: "Excluir este registro?",
    message: "O registro de métricas será removido. Essa ação não pode ser desfeita.",
    confirmText: "Excluir registro",
    tone: "danger",
  });
  if (!confirmed) return;

  try {
    await api(`/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.allLeads = state.allLeads.filter((l) => l.id !== id);
    renderMetricsTable(metricsSearchEl.value);
    notify.success("O registro foi removido.", { title: "Registro excluído" });
  } catch (err) {
    notify.error(err.message, { title: "Não foi possível excluir" });
  }
}

export async function refreshLeads() {
  if (metricsTbodyEl.contains(document.activeElement)) return;
  try {
    const { leads } = await api("/leads");
    state.allLeads = leads;
    await Promise.all([refreshBans(), refreshCallers()]);
    renderMetricsTable(metricsSearchEl.value);
  } catch (err) {
    console.error("refreshLeads falhou:", err);
    if (state.allLeads.length === 0) metricsTbodyEl.innerHTML = emptyRow("Não foi possível carregar as métricas", err.message);
  }
}

export function initMetrics() {
  metricsSearchEl.addEventListener("input", () => {
    state.metricsPage = 1;
    renderMetricsTable(metricsSearchEl.value);
  });
}
