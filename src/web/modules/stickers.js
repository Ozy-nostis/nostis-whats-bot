import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

const stickerGalleryModal = document.getElementById("sticker-gallery-modal");
const stickerGalleryGrid = document.getElementById("sticker-gallery-grid");
const stickerGalleryCancelBtn = document.getElementById("sticker-gallery-cancel");
const pickFromGalleryBtn = document.getElementById("campaign-pick-from-gallery-btn");

const campaignMediaFileInput = document.getElementById("campaign-media-file");
const campaignMediaPreview = document.getElementById("campaign-media-preview");
const campaignMediaImg = document.getElementById("campaign-media-img");

export async function openStickerGallery() {
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

export function selectGallerySticker(id) {
  state.campaignPendingGalleryStickerId = id;
  state.campaignHasNewMediaFile = false;
  state.campaignMediaRemoved = false;
  campaignMediaFileInput.value = "";
  campaignMediaImg.src = `/stickers/${encodeURIComponent(id)}/media`;
  campaignMediaPreview.classList.remove("hidden");
  stickerGalleryModal.classList.add("hidden");
}

export async function deleteGallerySticker(id) {
  if (!confirm("Remover esta figurinha da galeria?")) return;
  await fetch(`/stickers/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (state.campaignPendingGalleryStickerId === id) {
    state.campaignPendingGalleryStickerId = null;
    campaignMediaPreview.classList.add("hidden");
  }
  openStickerGallery();
}

export function initStickers() {
  pickFromGalleryBtn.addEventListener("click", openStickerGallery);
  stickerGalleryCancelBtn.addEventListener("click", () => stickerGalleryModal.classList.add("hidden"));
  stickerGalleryModal.addEventListener("click", (e) => {
    if (e.target === stickerGalleryModal) stickerGalleryModal.classList.add("hidden");
  });
}
