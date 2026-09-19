const statusEl = document.getElementById("status");
const onBtn = document.getElementById("on");
const offBtn = document.getElementById("off");
const waStatusEl = document.getElementById("wa-status");

export async function refreshStatus() {
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

export function initBotControls() {
  onBtn.addEventListener("click", async () => {
    await fetch("/on", { method: "POST" });
    refreshStatus();
  });

  offBtn.addEventListener("click", async () => {
    await fetch("/off", { method: "POST" });
    refreshStatus();
  });
}
