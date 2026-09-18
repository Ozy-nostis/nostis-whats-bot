const statusEl = document.getElementById("status");
const onBtn = document.getElementById("on");
const offBtn = document.getElementById("off");
const listEl = document.getElementById("groups-list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("groups-count");
const refreshGroupsBtn = document.getElementById("refresh-groups-btn");
const selectAllGroupsBtn = document.getElementById("select-all-groups-btn");
const deselectAllGroupsBtn = document.getElementById("deselect-all-groups-btn");
const waStatusEl = document.getElementById("wa-status");

const rulesListEl = document.getElementById("rules-list");
const newRuleBtn = document.getElementById("new-rule-btn");
const ruleModal = document.getElementById("rule-modal");
const ruleModalTitle = document.getElementById("rule-modal-title");
const keywordsInput = document.getElementById("rule-keywords");
const responsesInput = document.getElementById("rule-responses");
const cooldownInput = document.getElementById("rule-cooldown");
const trackMetricsInput = document.getElementById("rule-track-metrics");
const enabledInput = document.getElementById("rule-enabled");
const ruleCancelBtn = document.getElementById("rule-cancel");
const ruleSaveBtn = document.getElementById("rule-save");

const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

const campaignsListEl = document.getElementById("campaigns-list");
const newCampaignBtn = document.getElementById("new-campaign-btn");
const campaignModal = document.getElementById("campaign-modal");
const campaignModalTitle = document.getElementById("campaign-modal-title");
const campaignNameInput = document.getElementById("campaign-name");
const campaignMessageInput = document.getElementById("campaign-message");
const campaignIntervalInput = document.getElementById("campaign-interval");
const campaignMediaFileInput = document.getElementById("campaign-media-file");
const campaignMediaPreview = document.getElementById("campaign-media-preview");
const campaignMediaImg = document.getElementById("campaign-media-img");
const campaignMediaRemoveBtn = document.getElementById("campaign-media-remove");
const campaignStickerSource = document.getElementById("campaign-sticker-source");
const pickFromGalleryBtn = document.getElementById("campaign-pick-from-gallery-btn");
const campaignGroupSearch = document.getElementById("campaign-group-search");
const campaignGroupsListEl = document.getElementById("campaign-groups-list");
const campaignGroupsCountEl = document.getElementById("campaign-groups-count");
const campaignCancelBtn = document.getElementById("campaign-cancel");
const campaignSaveBtn = document.getElementById("campaign-save");

const stickerGalleryModal = document.getElementById("sticker-gallery-modal");
const stickerGalleryGrid = document.getElementById("sticker-gallery-grid");
const stickerGalleryCancelBtn = document.getElementById("sticker-gallery-cancel");

const metricsSearchEl = document.getElementById("metrics-search");
const metricsSummaryEl = document.getElementById("metrics-summary");
const metricsTbodyEl = document.getElementById("metrics-tbody");

let allGroups = [];
let enabledSet = new Set();
let allRules = [];
let editingRuleId = null;

let allLeads = [];

let allCampaigns = [];
let editingCampaignId = null;
let editingCampaignMedia = null; // { mediaType, mediaMimeType } da campanha em edição, se houver
let campaignSelectedGroups = new Set();
let campaignHasNewMediaFile = false;
let campaignMediaRemoved = false;
let campaignPendingGalleryStickerId = null;
const campaignPollTimers = new Map();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function updateCount() {
  countEl.textContent = `${enabledSet.size} selecionado(s) de ${allGroups.length}`;
  selectAllGroupsBtn.disabled = allGroups.length === 0;
  deselectAllGroupsBtn.disabled = enabledSet.size === 0;
}

function renderGroups(filter = "") {
  const f = filter.trim().toLowerCase();
  const visible = allGroups.filter(
    (g) => g.name.toLowerCase().includes(f) || g.jid.toLowerCase().includes(f)
  );

  if (visible.length === 0) {
    listEl.innerHTML = `<li class="empty">${
      allGroups.length === 0 ? "Nenhum grupo carregado" : "Nada encontrado"
    }</li>`;
    return;
  }

  listEl.innerHTML = visible
    .map((g) => {
      const avatar = g.hasPicture
        ? `<img class="group-avatar" src="/groups/picture/${encodeURIComponent(g.jid)}" alt="">`
        : `<div class="group-avatar placeholder">${escapeHtml((g.name[0] ?? "?").toUpperCase())}</div>`;

      return `
      <li>
        <input type="checkbox" data-jid="${g.jid}" ${enabledSet.has(g.jid) ? "checked" : ""}>
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
      if (enabled) enabledSet.add(jid);
      else enabledSet.delete(jid);
      updateCount();
    });
  });
}

async function refreshStatus() {
  try {
    const r = await fetch("/status");
    const { active, whatsappConnected } = await r.json();
    statusEl.textContent = active ? "ATIVO" : "DESLIGADO";
    statusEl.className = "status " + (active ? "on" : "off");
    onBtn.disabled = active;
    offBtn.disabled = !active;

    waStatusEl.textContent = whatsappConnected
      ? "🟢 WhatsApp conectado"
      : "🔴 WhatsApp desconectado";
    waStatusEl.className = "wa-status " + (whatsappConnected ? "connected" : "disconnected");
  } catch (err) {
    console.error("refreshStatus falhou:", err);
    statusEl.textContent = "SEM CONEXÃO";
    statusEl.className = "status off";
    waStatusEl.textContent = "🔴 WhatsApp desconectado";
    waStatusEl.className = "wa-status disconnected";
  }
}

async function refreshGroups() {
  try {
    const r = await fetch("/groups");
    const { groups, enabled } = await r.json();
    allGroups = groups;
    enabledSet = new Set(enabled);
    renderGroups(searchEl.value);
    updateCount();
  } catch (err) {
    console.error("refreshGroups falhou:", err);
  }
}

// --- Regras de resposta automática ---

function renderRules() {
  if (allRules.length === 0) {
    rulesListEl.innerHTML = `<li class="empty">Nenhuma regra cadastrada</li>`;
    return;
  }

  rulesListEl.innerHTML = allRules
    .map((r) => {
      const cooldownLabel =
        r.cooldownMinutes > 0 ? `${r.cooldownMinutes} min` : "sem cooldown";
      const replyLabel = r.replyToTrigger ? "↩ Reply" : "Mensagem solta";
      const reactionLabel = r.reactionEmoji ? `<span>Reage: ${r.reactionEmoji}</span>` : "";
      const metricsLabel = r.trackMetrics ? `<span>📊 Rastreando</span>` : "";

      return `
      <li class="rule-item ${r.enabled ? "" : "disabled"}">
        <div class="rule-main">
          <div class="rule-keywords" title="${escapeHtml(r.keywords.join(", "))}">
            ${escapeHtml(r.keywords.join(", "))}
          </div>
          <div class="rule-meta">
            <span>${r.responses.length} resposta(s)</span>
            <span>${cooldownLabel}</span>
            <span>${replyLabel}</span>
            ${reactionLabel}
            ${metricsLabel}
            <span class="${r.enabled ? "tag-on" : "tag-off"}">${r.enabled ? "Ativa" : "Inativa"}</span>
          </div>
        </div>
        <div class="rule-actions">
          <button class="edit-rule" data-id="${r.id}">Editar</button>
          <button class="delete-rule danger" data-id="${r.id}">Excluir</button>
        </div>
      </li>`;
    })
    .join("");

  rulesListEl.querySelectorAll(".edit-rule").forEach((btn) => {
    btn.addEventListener("click", () => openRuleModal(btn.dataset.id));
  });
  rulesListEl.querySelectorAll(".delete-rule").forEach((btn) => {
    btn.addEventListener("click", () => deleteRule(btn.dataset.id));
  });
}

async function refreshRules() {
  try {
    const r = await fetch("/rules");
    const { rules } = await r.json();
    allRules = rules;
    renderRules();
  } catch (err) {
    console.error("refreshRules falhou:", err);
  }
}

function openRuleModal(id) {
  editingRuleId = id ?? null;
  const rule = id ? allRules.find((r) => r.id === id) : null;

  ruleModalTitle.textContent = rule ? "Editar regra" : "Nova regra";
  keywordsInput.value = rule ? rule.keywords.join("\n") : "";
  responsesInput.value = rule ? rule.responses.join("\n") : "";
  cooldownInput.value = rule ? rule.cooldownMinutes : 0;
  trackMetricsInput.checked = rule ? rule.trackMetrics : false;
  enabledInput.checked = rule ? rule.enabled : true;

  const replyToTrigger = rule ? rule.replyToTrigger : true;
  document.querySelectorAll('input[name="rule-reply-mode"]').forEach((r) => {
    r.checked = r.value === (replyToTrigger ? "quote" : "plain");
  });

  const reactionEmoji = rule ? rule.reactionEmoji || "" : "";
  document.querySelectorAll('input[name="rule-reaction"]').forEach((r) => {
    r.checked = r.value === reactionEmoji;
  });

  ruleModal.classList.remove("hidden");
  keywordsInput.focus();
}

function closeRuleModal() {
  ruleModal.classList.add("hidden");
  editingRuleId = null;
}

async function saveRule() {
  const keywords = keywordsInput.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const responses = responsesInput.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const cooldownMinutes = Math.max(0, Number(cooldownInput.value) || 0);
  const enabled = enabledInput.checked;
  const trackMetrics = trackMetricsInput.checked;
  const replyToTrigger = document.querySelector('input[name="rule-reply-mode"]:checked').value === "quote";
  const reactionEmoji = document.querySelector('input[name="rule-reaction"]:checked').value || null;

  if (keywords.length === 0 || responses.length === 0) {
    alert("Informe ao menos uma mensagem-gatilho e uma resposta.");
    return;
  }

  const payload = {
    keywords,
    responses,
    cooldownMinutes,
    replyToTrigger,
    reactionEmoji,
    trackMetrics,
    enabled,
  };

  ruleSaveBtn.disabled = true;
  try {
    let r;
    if (editingRuleId) {
      r = await fetch(`/rules/${encodeURIComponent(editingRuleId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      r = await fetch("/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Não foi possível salvar a regra.");

    closeRuleModal();
    await refreshRules();
  } catch (err) {
    console.error("saveRule falhou:", err);
    alert(err.message);
  } finally {
    ruleSaveBtn.disabled = false;
  }
}

async function deleteRule(id) {
  if (!confirm("Excluir esta regra?")) return;
  await fetch(`/rules/${encodeURIComponent(id)}`, { method: "DELETE" });
  refreshRules();
}

newRuleBtn.addEventListener("click", () => openRuleModal(null));
ruleCancelBtn.addEventListener("click", closeRuleModal);
ruleSaveBtn.addEventListener("click", saveRule);
ruleModal.addEventListener("click", (e) => {
  if (e.target === ruleModal) closeRuleModal();
});

onBtn.addEventListener("click", async () => {
  await fetch("/on", { method: "POST" });
  refreshStatus();
});

offBtn.addEventListener("click", async () => {
  await fetch("/off", { method: "POST" });
  refreshStatus();
});

searchEl.addEventListener("input", () => renderGroups(searchEl.value));

refreshGroupsBtn.addEventListener("click", async () => {
  refreshGroupsBtn.disabled = true;
  const originalLabel = refreshGroupsBtn.textContent;
  refreshGroupsBtn.textContent = "Atualizando...";
  try {
    const r = await fetch("/groups/refresh", { method: "POST" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Falha ao atualizar grupos (status ${r.status}).`);
    allGroups = data.groups;
    enabledSet = new Set(data.enabled);
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
  if (!confirm(`Selecionar todos os ${allGroups.length} grupos carregados?`)) return;

  selectAllGroupsBtn.disabled = true;
  try {
    const r = await fetch("/groups/select-all", { method: "POST" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Falha ao selecionar todos os grupos (status ${r.status}).`);
    allGroups = data.groups;
    enabledSet = new Set(data.enabled);
    renderGroups(searchEl.value);
    updateCount();
  } catch (err) {
    console.error("select-all falhou:", err);
    alert(err.message);
    updateCount();
  }
});

deselectAllGroupsBtn.addEventListener("click", async () => {
  if (!confirm(`Remover a seleção de todos os ${enabledSet.size} grupos habilitados?`)) return;

  deselectAllGroupsBtn.disabled = true;
  try {
    const r = await fetch("/groups/deselect-all", { method: "POST" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Falha ao desmarcar os grupos (status ${r.status}).`);
    allGroups = data.groups;
    enabledSet = new Set(data.enabled);
    renderGroups(searchEl.value);
    updateCount();
  } catch (err) {
    console.error("deselect-all falhou:", err);
    alert(err.message);
    updateCount();
  }
});

// --- Abas (Regras / Propaganda) ---

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanels.forEach((p) => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
  });
});

// --- Campanhas de propaganda ---

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = dataUrl;
  });
}

/**
 * Figurinhas do WhatsApp precisam ser webp de verdade (o baileys não converte
 * o arquivo, só rotula os bytes). Por isso a conversão é feita aqui no
 * navegador via Canvas antes de mandar pro servidor.
 */
async function convertImageToStickerWebp(file) {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) {
    throw new Error("Este navegador não conseguiu gerar webp. Tente pelo Chrome ou Edge.");
  }
  const b64DataUrl = await fileToDataUrl(blob);
  return { type: "sticker", dataBase64: b64DataUrl.split(",")[1], mimeType: "image/webp" };
}

async function readImageAsMedia(file) {
  const dataUrl = await fileToDataUrl(file);
  return { type: "image", dataBase64: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" };
}

async function fetchLibraryStickerAsMedia(id) {
  const r = await fetch(`/stickers/${encodeURIComponent(id)}/media`);
  if (!r.ok) throw new Error("Não foi possível carregar a figurinha da galeria.");
  const blob = await r.blob();
  const dataUrl = await fileToDataUrl(blob);
  return { type: "sticker", dataBase64: dataUrl.split(",")[1], mimeType: "image/webp" };
}

function selectedMediaType() {
  return document.querySelector('input[name="media-type"]:checked').value;
}

function setMediaType(type) {
  document.querySelectorAll('input[name="media-type"]').forEach((r) => {
    r.checked = r.value === type;
  });
  campaignMediaFileInput.classList.toggle("hidden", type === "none");
  campaignStickerSource.classList.toggle("hidden", type !== "sticker");
  if (type === "none") campaignMediaPreview.classList.add("hidden");
}

document.querySelectorAll('input[name="media-type"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const type = selectedMediaType();
    campaignMediaFileInput.classList.toggle("hidden", type === "none");
    campaignStickerSource.classList.toggle("hidden", type !== "sticker");
    campaignMediaFileInput.value = "";
    campaignHasNewMediaFile = false;
    campaignPendingGalleryStickerId = null;
    if (type === "none") {
      campaignMediaPreview.classList.add("hidden");
      campaignMediaRemoved = true;
    } else if (!editingCampaignMedia || editingCampaignMedia.mediaType !== type) {
      campaignMediaPreview.classList.add("hidden");
    }
  });
});

campaignMediaFileInput.addEventListener("change", async () => {
  const file = campaignMediaFileInput.files[0];
  if (!file) return;
  campaignHasNewMediaFile = true;
  campaignMediaRemoved = false;
  campaignPendingGalleryStickerId = null;
  const previewUrl = await fileToDataUrl(file);
  campaignMediaImg.src = previewUrl;
  campaignMediaPreview.classList.remove("hidden");
});

campaignMediaRemoveBtn.addEventListener("click", () => {
  campaignMediaFileInput.value = "";
  campaignMediaPreview.classList.add("hidden");
  campaignHasNewMediaFile = false;
  campaignMediaRemoved = true;
  campaignPendingGalleryStickerId = null;
  setMediaType("none");
});

// --- Galeria de figurinhas coletadas automaticamente ---

async function openStickerGallery() {
  stickerGalleryGrid.innerHTML = `<p class="gallery-empty">Carregando...</p>`;
  stickerGalleryModal.classList.remove("hidden");
  try {
    const r = await fetch("/stickers");
    const { stickers } = await r.json();

    if (stickers.length === 0) {
      stickerGalleryGrid.innerHTML =
        `<p class="gallery-empty">Nenhuma figurinha coletada ainda. Elas aparecem aqui conforme circulam nos grupos do bot.</p>`;
      return;
    }

    stickerGalleryGrid.innerHTML = stickers
      .map(
        (s) => `
        <div class="sticker-thumb-wrap">
          <button type="button" class="sticker-thumb" data-id="${s.id}" title="Visto em: ${escapeHtml(s.sourceGroupName)}">
            <img src="/stickers/${encodeURIComponent(s.id)}/media" alt="">
          </button>
          <button type="button" class="sticker-thumb-delete" data-id="${s.id}" title="Remover da galeria">✕</button>
        </div>`
      )
      .join("");

    stickerGalleryGrid.querySelectorAll(".sticker-thumb").forEach((btn) => {
      btn.addEventListener("click", () => selectGallerySticker(btn.dataset.id));
    });
    stickerGalleryGrid.querySelectorAll(".sticker-thumb-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteGallerySticker(btn.dataset.id);
      });
    });
  } catch (err) {
    console.error("openStickerGallery falhou:", err);
    stickerGalleryGrid.innerHTML = `<p class="gallery-empty">Falha ao carregar a galeria.</p>`;
  }
}

function selectGallerySticker(id) {
  campaignPendingGalleryStickerId = id;
  campaignHasNewMediaFile = false;
  campaignMediaRemoved = false;
  campaignMediaFileInput.value = "";
  campaignMediaImg.src = `/stickers/${encodeURIComponent(id)}/media`;
  campaignMediaPreview.classList.remove("hidden");
  stickerGalleryModal.classList.add("hidden");
}

async function deleteGallerySticker(id) {
  if (!confirm("Remover esta figurinha da galeria?")) return;
  await fetch(`/stickers/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (campaignPendingGalleryStickerId === id) {
    campaignPendingGalleryStickerId = null;
    campaignMediaPreview.classList.add("hidden");
  }
  openStickerGallery();
}

pickFromGalleryBtn.addEventListener("click", openStickerGallery);
stickerGalleryCancelBtn.addEventListener("click", () => stickerGalleryModal.classList.add("hidden"));
stickerGalleryModal.addEventListener("click", (e) => {
  if (e.target === stickerGalleryModal) stickerGalleryModal.classList.add("hidden");
});

function renderCampaignGroupPicker(filter = "") {
  const f = filter.trim().toLowerCase();
  const visible = allGroups.filter(
    (g) => g.name.toLowerCase().includes(f) || g.jid.toLowerCase().includes(f)
  );

  if (visible.length === 0) {
    campaignGroupsListEl.innerHTML = `<li class="empty">${
      allGroups.length === 0 ? "Nenhum grupo carregado" : "Nada encontrado"
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
        <input type="checkbox" data-jid="${g.jid}" ${campaignSelectedGroups.has(g.jid) ? "checked" : ""}>
        ${avatar}
        <span class="group-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
      </li>`;
    })
    .join("");

  campaignGroupsListEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const jid = e.target.dataset.jid;
      if (e.target.checked) campaignSelectedGroups.add(jid);
      else campaignSelectedGroups.delete(jid);
      campaignGroupsCountEl.textContent = `${campaignSelectedGroups.size} selecionado(s)`;
    });
  });
}

campaignGroupSearch.addEventListener("input", () => renderCampaignGroupPicker(campaignGroupSearch.value));

function mediaLabel(campaign) {
  if (campaign.mediaType === "sticker") return "🏷️ Figurinha";
  if (campaign.mediaType === "image") return "🖼️ Imagem";
  return "Somente texto";
}

function renderCampaigns() {
  if (allCampaigns.length === 0) {
    campaignsListEl.innerHTML = `<li class="empty">Nenhuma campanha cadastrada</li>`;
    return;
  }

  campaignsListEl.innerHTML = allCampaigns
    .map(
      (c) => `
      <li class="rule-item campaign-item" data-id="${c.id}">
        <div class="rule-main">
          <div class="rule-keywords">${escapeHtml(c.name)}</div>
          <div class="rule-meta">
            <span>${c.groupJids.length} grupo(s)</span>
            <span>${mediaLabel(c)}</span>
            <span>Intervalo: ${c.intervalSeconds}s</span>
          </div>
          <div class="campaign-progress" data-progress-for="${c.id}"></div>
        </div>
        <div class="rule-actions">
          <button class="send-campaign" data-id="${c.id}">📢 Enviar agora</button>
          <button class="edit-campaign" data-id="${c.id}">Editar</button>
          <button class="delete-campaign danger" data-id="${c.id}">Excluir</button>
        </div>
      </li>`
    )
    .join("");

  campaignsListEl.querySelectorAll(".send-campaign").forEach((btn) => {
    btn.addEventListener("click", () => sendCampaignNow(btn.dataset.id));
  });
  campaignsListEl.querySelectorAll(".edit-campaign").forEach((btn) => {
    btn.addEventListener("click", () => openCampaignModal(btn.dataset.id));
  });
  campaignsListEl.querySelectorAll(".delete-campaign").forEach((btn) => {
    btn.addEventListener("click", () => deleteCampaign(btn.dataset.id));
  });

  // Se a página foi recarregada durante um envio em andamento, retoma o acompanhamento.
  for (const c of allCampaigns) {
    if (!campaignPollTimers.has(c.id)) checkAndResumePolling(c.id);
  }
}

async function checkAndResumePolling(id) {
  try {
    const r = await fetch(`/campaigns/${encodeURIComponent(id)}/status`);
    const state = await r.json();
    if (state.status === "sending") pollCampaignStatus(id);
  } catch {
    // silencioso — só é uma tentativa de retomar o acompanhamento
  }
}

async function refreshCampaigns() {
  try {
    const r = await fetch("/campaigns");
    const { campaigns } = await r.json();
    allCampaigns = campaigns;
    renderCampaigns();
  } catch (err) {
    console.error("refreshCampaigns falhou:", err);
  }
}

function openCampaignModal(id) {
  editingCampaignId = id ?? null;
  const campaign = id ? allCampaigns.find((c) => c.id === id) : null;

  campaignHasNewMediaFile = false;
  campaignMediaRemoved = false;
  campaignPendingGalleryStickerId = null;
  campaignMediaFileInput.value = "";
  editingCampaignMedia = campaign ? { mediaType: campaign.mediaType, mediaMimeType: campaign.mediaMimeType } : null;

  campaignModalTitle.textContent = campaign ? "Editar campanha" : "Nova campanha";
  campaignNameInput.value = campaign ? campaign.name : "";
  campaignMessageInput.value = campaign ? campaign.message : "";
  campaignIntervalInput.value = campaign ? campaign.intervalSeconds : 5;
  campaignSelectedGroups = new Set(campaign ? campaign.groupJids : []);

  const mediaType = campaign ? campaign.mediaType : "none";
  setMediaType(mediaType);

  if (campaign && mediaType !== "none") {
    campaignMediaImg.src = `/campaigns/${encodeURIComponent(campaign.id)}/media?t=${campaign.updatedAt}`;
    campaignMediaPreview.classList.remove("hidden");
  } else {
    campaignMediaPreview.classList.add("hidden");
  }

  campaignGroupSearch.value = "";
  renderCampaignGroupPicker();
  campaignGroupsCountEl.textContent = `${campaignSelectedGroups.size} selecionado(s)`;

  campaignModal.classList.remove("hidden");
  campaignNameInput.focus();
}

function closeCampaignModal() {
  campaignModal.classList.add("hidden");
  editingCampaignId = null;
  editingCampaignMedia = null;
}

async function saveCampaign() {
  const name = campaignNameInput.value.trim();
  const message = campaignMessageInput.value.trim();
  const intervalSeconds = Math.max(1, Number(campaignIntervalInput.value) || 5);
  const groupJids = [...campaignSelectedGroups];
  const mediaType = selectedMediaType();
  const file = campaignMediaFileInput.files[0];

  const keepsExistingMedia =
    editingCampaignMedia && editingCampaignMedia.mediaType === mediaType && !campaignMediaRemoved;
  const hasMediaSource = campaignPendingGalleryStickerId || file || keepsExistingMedia;

  if (!name) return alert("Informe um nome para a campanha.");
  if (groupJids.length === 0) return alert("Selecione ao menos um grupo de destino para a campanha.");
  if (!message && mediaType === "none") {
    return alert("Informe uma mensagem ou selecione uma mídia (figurinha/imagem).");
  }
  if (mediaType !== "none" && !hasMediaSource) {
    return alert("Selecione um arquivo, escolha uma figurinha da galeria, ou volte para \"Sem mídia\".");
  }

  const payload = { name, message, groupJids, intervalSeconds };

  campaignSaveBtn.disabled = true;
  campaignSaveBtn.textContent = "Salvando...";
  try {
    if (mediaType === "none") {
      if (editingCampaignMedia && editingCampaignMedia.mediaType !== "none") payload.removeMedia = true;
    } else if (campaignPendingGalleryStickerId) {
      payload.media = await fetchLibraryStickerAsMedia(campaignPendingGalleryStickerId);
    } else if (campaignHasNewMediaFile && file) {
      payload.media =
        mediaType === "sticker" ? await convertImageToStickerWebp(file) : await readImageAsMedia(file);
    }

    const r = await fetch(
      editingCampaignId ? `/campaigns/${encodeURIComponent(editingCampaignId)}` : "/campaigns",
      {
        method: editingCampaignId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Não foi possível salvar a campanha.");

    closeCampaignModal();
    await refreshCampaigns();
  } catch (err) {
    console.error("saveCampaign falhou:", err);
    alert(err.message);
  } finally {
    campaignSaveBtn.disabled = false;
    campaignSaveBtn.textContent = "Salvar";
  }
}

async function deleteCampaign(id) {
  const campaign = allCampaigns.find((c) => c.id === id);
  if (!confirm(`Excluir a campanha "${campaign ? campaign.name : ""}"?`)) return;

  const r = await fetch(`/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    alert(data.error || "Não foi possível excluir a campanha.");
    return;
  }
  refreshCampaigns();
}

async function sendCampaignNow(id) {
  const campaign = allCampaigns.find((c) => c.id === id);
  if (!campaign) return;

  if (!confirm(`Enviar a campanha "${campaign.name}" agora para ${campaign.groupJids.length} grupo(s)?`)) {
    return;
  }

  const r = await fetch(`/campaigns/${encodeURIComponent(id)}/send`, { method: "POST" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    alert(data.error || "Não foi possível iniciar o envio da campanha.");
    return;
  }
  pollCampaignStatus(id);
}

function pollCampaignStatus(id) {
  if (campaignPollTimers.has(id)) return;

  const timer = setInterval(async () => {
    const progressEl = document.querySelector(`[data-progress-for="${id}"]`);
    try {
      const r = await fetch(`/campaigns/${encodeURIComponent(id)}/status`);
      const state = await r.json();

      if (state.status === "sending" && progressEl) {
        progressEl.textContent = `Enviando... ${state.sent}/${state.total}`;
      }

      if (state.status === "done") {
        clearInterval(timer);
        campaignPollTimers.delete(id);
        const failed = state.results.filter((res) => !res.ok);
        if (progressEl) {
          progressEl.textContent =
            failed.length === 0
              ? `✅ Enviado para todos os ${state.total} grupos.`
              : `⚠️ Enviado para ${state.total - failed.length}/${state.total}. Falhou em: ${failed
                  .map((f) => f.groupName)
                  .join(", ")}`;
        }
      }
    } catch (err) {
      console.error("poll de status falhou:", err);
    }
  }, 1000);

  campaignPollTimers.set(id, timer);
}

newCampaignBtn.addEventListener("click", () => openCampaignModal(null));
campaignCancelBtn.addEventListener("click", closeCampaignModal);
campaignSaveBtn.addEventListener("click", saveCampaign);
campaignModal.addEventListener("click", (e) => {
  if (e.target === campaignModal) closeCampaignModal();
});

// --- Métricas de chamadas ---

function formatDateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function phoneFromJid(jid) {
  return (jid || "").split("@")[0];
}

function renderMetricsSummary(leads) {
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

function renderMetricsTable(filter = "") {
  const f = filter.trim().toLowerCase();
  const visible = allLeads.filter(
    (l) =>
      l.groupName.toLowerCase().includes(f) ||
      (l.callerName || "").toLowerCase().includes(f) ||
      phoneFromJid(l.callerJid).includes(f)
  );

  renderMetricsSummary(allLeads);

  if (visible.length === 0) {
    metricsTbodyEl.innerHTML = `<tr><td colspan="7" class="empty">${
      allLeads.length === 0
        ? "Nenhum gatilho rastreado ainda. Ative \"Rastrear métricas\" numa regra pra começar."
        : "Nada encontrado."
    }</td></tr>`;
    return;
  }

  metricsTbodyEl.innerHTML = visible
    .map((l) => {
      const person = escapeHtml(l.callerName || phoneFromJid(l.callerJid));
      const privateContact = l.privateContactAt
        ? formatDateTime(l.privateContactAt)
        : `<span class="tag-off">Ainda não</span>`;

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
        <td><button class="delete-lead danger" data-id="${l.id}">Excluir</button></td>
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
}

async function updateLead(id, patch) {
  try {
    const r = await fetch(`/leads/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Não foi possível salvar.");

    const lead = allLeads.find((l) => l.id === id);
    if (lead) Object.assign(lead, data.lead);
    renderMetricsSummary(allLeads);
  } catch (err) {
    console.error("updateLead falhou:", err);
    alert(err.message);
    refreshLeads();
  }
}

async function deleteLead(id) {
  if (!confirm("Excluir este registro de métricas?")) return;
  await fetch(`/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
  // Atualiza o estado local direto (em vez de refreshLeads) porque o botão
  // clicado ainda está focado dentro da tbody nesse instante, e o guard de
  // "não atrapalhar edição em andamento" do refreshLeads bloquearia o refresh.
  allLeads = allLeads.filter((l) => l.id !== id);
  renderMetricsTable(metricsSearchEl.value);
}

async function refreshLeads() {
  // Evita apagar uma edição em andamento (valor/status) quando o polling automático dispara.
  if (metricsTbodyEl.contains(document.activeElement)) return;
  try {
    const r = await fetch("/leads");
    const { leads } = await r.json();
    allLeads = leads;
    renderMetricsTable(metricsSearchEl.value);
  } catch (err) {
    console.error("refreshLeads falhou:", err);
  }
}

metricsSearchEl.addEventListener("input", () => renderMetricsTable(metricsSearchEl.value));

// Inicialização
refreshStatus();
refreshGroups();
refreshRules();
refreshCampaigns();
refreshLeads();
setInterval(refreshStatus, 2000);
setInterval(refreshGroups, 10000);
setInterval(refreshLeads, 15000);
