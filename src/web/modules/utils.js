export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = dataUrl;
  });
}

export async function convertImageToStickerWebp(file) {
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

export async function readImageAsMedia(file) {
  const dataUrl = await fileToDataUrl(file);
  return { type: "image", dataBase64: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" };
}

export function formatDateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function phoneFromJid(jid) {
  return (jid || "").split("@")[0];
}

export function callerBadgeHtml(count) {
  if (count <= 0) return "";
  const tier = count >= 4 ? "hot" : count >= 2 ? "warm" : "cold";
  const emoji = tier === "hot" ? "🔥" : "🔁";
  const title = `Já chamou ${count}x (conta de novo só depois de 2h da última chamada)`;
  return ` <span class="caller-badge caller-badge-${tier}" title="${title}">${emoji} ${count}x</span>`;
}
