import { state } from "./state.js";
import { escapeHtml, fileToDataUrl, convertImageToStickerWebp, readImageAsMedia } from "./utils.js";
import { renderCampaignGroupPicker } from "./groups.js";

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
const campaignGroupSearch = document.getElementById("campaign-group-search");
const campaignGroupsCountEl = document.getElementById("campaign-groups-count");
const campaignCancelBtn = document.getElementById("campaign-cancel");
const campaignSaveBtn = document.getElementById("campaign-save");

export async function fetchLibraryStickerAsMedia(id) {
  const r = await fetch(`/stickers/${encodeURIComponent(id)}/media`);
  if (!r.ok) throw new Error("Não foi possível carregar a figurinha da galeria.");
  const blob = await r.blob();
  const dataUrl = await fileToDataUrl(blob);
  return { type: "sticker", dataBase64: dataUrl.split(",")[1], mimeType: "image/webp" };
}

export function selectedMediaType() {
  return document.querySelector('input[name="media-type"]:checked').value;
}

export function setMediaType(type) {
  document.querySelectorAll('input[name="media-type"]').forEach((r) => {
    r.checked = r.value === type;
  });
  campaignMediaFileInput.classList.toggle("hidden", type === "none");
  campaignStickerSource.classList.toggle("hidden", type !== "sticker");
  if (type === "none") campaignMediaPreview.classList.add("hidden");
}

export function mediaLabel(campaign) {
  if (campaign.mediaType === "sticker") return "🏷️ Figurinha";
  if (campaign.mediaType === "image") return "🖼️ Imagem";
  return "Somente texto";
}

export function renderCampaigns() {
  if (state.allCampaigns.length === 0) {
    campaignsListEl.innerHTML = `<li class="empty">Nenhuma campanha cadastrada</li>`;
    return;
  }

  campaignsListEl.innerHTML = state.allCampaigns
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

  for (const c of state.allCampaigns) {
    if (!state.campaignPollTimers.has(c.id)) checkAndResumePolling(c.id);
  }
}

export async function checkAndResumePolling(id) {
  try {
    const r = await fetch(`/campaigns/${encodeURIComponent(id)}/status`);
    const s = await r.json();
    if (s.status === "sending") pollCampaignStatus(id);
  } catch {
    // silencioso
  }
}

export async function refreshCampaigns() {
  try {
    const r = await fetch("/campaigns");
    const { campaigns } = await r.json();
    state.allCampaigns = campaigns;
    renderCampaigns();
  } catch (err) {
    console.error("refreshCampaigns falhou:", err);
  }
}

export function openCampaignModal(id) {
  state.editingCampaignId = id ?? null;
  const campaign = id ? state.allCampaigns.find((c) => c.id === id) : null;

  state.campaignHasNewMediaFile = false;
  state.campaignMediaRemoved = false;
  state.campaignPendingGalleryStickerId = null;
  campaignMediaFileInput.value = "";
  state.editingCampaignMedia = campaign ? { mediaType: campaign.mediaType, mediaMimeType: campaign.mediaMimeType } : null;

  campaignModalTitle.textContent = campaign ? "Editar campanha" : "Nova campanha";
  campaignNameInput.value = campaign ? campaign.name : "";
  campaignMessageInput.value = campaign ? campaign.message : "";
  campaignIntervalInput.value = campaign ? campaign.intervalSeconds : 5;
  state.campaignSelectedGroups = new Set(campaign ? campaign.groupJids : []);

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
  campaignGroupsCountEl.textContent = `${state.campaignSelectedGroups.size} selecionado(s)`;

  campaignModal.classList.remove("hidden");
  campaignNameInput.focus();
}

export function closeCampaignModal() {
  campaignModal.classList.add("hidden");
  state.editingCampaignId = null;
  state.editingCampaignMedia = null;
}

export async function saveCampaign() {
  const name = campaignNameInput.value.trim();
  const message = campaignMessageInput.value.trim();
  const intervalSeconds = Math.max(1, Number(campaignIntervalInput.value) || 5);
  const groupJids = [...state.campaignSelectedGroups];
  const mediaType = selectedMediaType();
  const file = campaignMediaFileInput.files[0];

  const keepsExistingMedia =
    state.editingCampaignMedia && state.editingCampaignMedia.mediaType === mediaType && !state.campaignMediaRemoved;
  const hasMediaSource = state.campaignPendingGalleryStickerId || file || keepsExistingMedia;

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
      if (state.editingCampaignMedia && state.editingCampaignMedia.mediaType !== "none") payload.removeMedia = true;
    } else if (state.campaignPendingGalleryStickerId) {
      payload.media = await fetchLibraryStickerAsMedia(state.campaignPendingGalleryStickerId);
    } else if (state.campaignHasNewMediaFile && file) {
      payload.media =
        mediaType === "sticker" ? await convertImageToStickerWebp(file) : await readImageAsMedia(file);
    }

    const r = await fetch(
      state.editingCampaignId ? `/campaigns/${encodeURIComponent(state.editingCampaignId)}` : "/campaigns",
      {
        method: state.editingCampaignId ? "PUT" : "POST",
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

export async function deleteCampaign(id) {
  const campaign = state.allCampaigns.find((c) => c.id === id);
  if (!confirm(`Excluir a campanha "${campaign ? campaign.name : ""}"?`)) return;

  const r = await fetch(`/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    alert(data.error || "Não foi possível excluir a campanha.");
    return;
  }
  refreshCampaigns();
}

export async function sendCampaignNow(id) {
  const campaign = state.allCampaigns.find((c) => c.id === id);
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

export function pollCampaignStatus(id) {
  if (state.campaignPollTimers.has(id)) return;

  const timer = setInterval(async () => {
    const progressEl = document.querySelector(`[data-progress-for="${id}"]`);
    try {
      const r = await fetch(`/campaigns/${encodeURIComponent(id)}/status`);
      const s = await r.json();

      if (s.status === "sending" && progressEl) {
        progressEl.textContent = `Enviando... ${s.sent}/${s.total}`;
      }

      if (s.status === "done") {
        clearInterval(timer);
        state.campaignPollTimers.delete(id);
        const failed = s.results.filter((res) => !res.ok);
        if (progressEl) {
          progressEl.textContent =
            failed.length === 0
              ? `✅ Enviado para todos os ${s.total} grupos.`
              : `⚠️ Enviado para ${s.total - failed.length}/${s.total}. Falhou em: ${failed
                  .map((f) => f.groupName)
                  .join(", ")}`;
        }
      }
    } catch (err) {
      console.error("poll de status falhou:", err);
    }
  }, 1000);

  state.campaignPollTimers.set(id, timer);
}

export function initCampaigns() {
  document.querySelectorAll('input[name="media-type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const type = selectedMediaType();
      campaignMediaFileInput.classList.toggle("hidden", type === "none");
      campaignStickerSource.classList.toggle("hidden", type !== "sticker");
      campaignMediaFileInput.value = "";
      state.campaignHasNewMediaFile = false;
      state.campaignPendingGalleryStickerId = null;
      if (type === "none") {
        campaignMediaPreview.classList.add("hidden");
        state.campaignMediaRemoved = true;
      } else if (!state.editingCampaignMedia || state.editingCampaignMedia.mediaType !== type) {
        campaignMediaPreview.classList.add("hidden");
      }
    });
  });

  campaignMediaFileInput.addEventListener("change", async () => {
    const file = campaignMediaFileInput.files[0];
    if (!file) return;
    state.campaignHasNewMediaFile = true;
    state.campaignMediaRemoved = false;
    state.campaignPendingGalleryStickerId = null;
    const previewUrl = await fileToDataUrl(file);
    campaignMediaImg.src = previewUrl;
    campaignMediaPreview.classList.remove("hidden");
  });

  campaignMediaRemoveBtn.addEventListener("click", () => {
    campaignMediaFileInput.value = "";
    campaignMediaPreview.classList.add("hidden");
    state.campaignHasNewMediaFile = false;
    state.campaignMediaRemoved = true;
    state.campaignPendingGalleryStickerId = null;
    setMediaType("none");
  });

  newCampaignBtn.addEventListener("click", () => openCampaignModal(null));
  campaignCancelBtn.addEventListener("click", closeCampaignModal);
  campaignSaveBtn.addEventListener("click", saveCampaign);
  campaignModal.addEventListener("click", (e) => {
    if (e.target === campaignModal) closeCampaignModal();
  });
}
