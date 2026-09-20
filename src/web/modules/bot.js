import { api } from "./api.js";
import { icon, notify } from "./ui.js";

const statusEl = document.getElementById("status");
const statusTextEl = document.getElementById("status-text");
const toggleBtn = document.getElementById("toggle-bot");
const waStatusEl = document.getElementById("wa-status");
const waTitleEl = document.getElementById("wa-status-title");
const waSubEl = document.getElementById("wa-status-sub");
const offlineBanner = document.getElementById("offline-banner");

let botActive = null; // último estado conhecido do bot
let waConnected = null; // último estado conhecido do WhatsApp
let offline = false;
let requestInFlight = false;

function paintBot(active) {
  statusEl.dataset.state = active ? "on" : "off";
  statusTextEl.textContent = active ? "Ativo" : "Desligado";

  toggleBtn.dataset.mode = active ? "on" : "off";
  toggleBtn.innerHTML = active
    ? `${icon("pause")} <span>Desligar bot</span>`
    : `${icon("power")} <span>Ligar bot</span>`;
  toggleBtn.disabled = requestInFlight;
}

function paintWhatsApp(connected) {
  waStatusEl.dataset.state = connected ? "connected" : "disconnected";
  waTitleEl.textContent = connected ? "WhatsApp conectado" : "WhatsApp desconectado";
  waSubEl.textContent = connected ? "Pronto para responder e enviar" : "Aguardando conexão ou leitura do QR Code";
}

function paintOffline() {
  statusEl.dataset.state = "offline";
  statusTextEl.textContent = "Sem conexão";
  toggleBtn.disabled = true;
  waStatusEl.dataset.state = "disconnected";
  waTitleEl.textContent = "Painel sem conexão";
  waSubEl.textContent = "Não foi possível falar com o bot";
}

export async function refreshStatus() {
  try {
    const { active, whatsappConnected } = await api("/status");

    if (offline) {
      offline = false;
      offlineBanner.classList.add("hidden");
      notify.success("Conexão com o bot restabelecida.");
    }

    // Só avisa quando o estado *muda* durante o uso (não na primeira leitura).
    if (waConnected !== null && waConnected !== whatsappConnected) {
      if (whatsappConnected) notify.success("O bot está online e pronto para uso.", { title: "WhatsApp conectado" });
      else notify.warning("O bot perdeu a conexão. Ele tenta reconectar sozinho; se pedir, leia o QR Code de novo.", { title: "WhatsApp desconectado" });
    }

    botActive = active;
    waConnected = whatsappConnected;
    paintBot(active);
    paintWhatsApp(whatsappConnected);
  } catch (err) {
    console.error("refreshStatus falhou:", err);
    if (!offline) {
      offline = true;
      offlineBanner.classList.remove("hidden");
    }
    paintOffline();
  }
}

export function initBotControls() {
  toggleBtn.addEventListener("click", async () => {
    if (botActive === null || requestInFlight) return;
    const turningOn = !botActive;

    requestInFlight = true;
    toggleBtn.disabled = true;
    try {
      await api(turningOn ? "/on" : "/off", { method: "POST" });
      botActive = turningOn;

      if (turningOn && waConnected === false) {
        notify.warning("O bot foi ligado, mas o WhatsApp está desconectado — ele só responde depois de conectar.", { title: "Bot ligado" });
      } else if (turningOn) {
        notify.success("Agora ele responde nos grupos selecionados.", { title: "Bot ligado" });
      } else {
        notify.info("O bot parou de responder até você ligar de novo.", { title: "Bot desligado" });
      }
    } catch (err) {
      notify.error(err.message);
    } finally {
      requestInFlight = false;
      refreshStatus();
    }
  });
}
