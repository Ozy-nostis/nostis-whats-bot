import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

const rulesListEl = document.getElementById("rules-list");
const newRuleBtn = document.getElementById("new-rule-btn");
const ruleModal = document.getElementById("rule-modal");
const ruleModalTitle = document.getElementById("rule-modal-title");
const keywordsInput = document.getElementById("rule-keywords");
const responsesInput = document.getElementById("rule-responses");
const cooldownInput = document.getElementById("rule-cooldown");
const trackMetricsInput = document.getElementById("rule-track-metrics");
const enabledInput = document.getElementById("rule-enabled");
const ruleReplyModeWrap = document.getElementById("rule-reply-mode-wrap");
const useUrlButtonInput = document.getElementById("rule-use-url-button");
const buttonTextWrap = document.getElementById("rule-button-text-wrap");
const buttonTextInput = document.getElementById("rule-button-text");
const ruleCancelBtn = document.getElementById("rule-cancel");
const ruleSaveBtn = document.getElementById("rule-save");

export function renderRules() {
  if (state.allRules.length === 0) {
    rulesListEl.innerHTML = `<li class="empty">Nenhuma regra cadastrada</li>`;
    return;
  }

  rulesListEl.innerHTML = state.allRules
    .map((r) => {
      const cooldownLabel =
        r.cooldownMinutes > 0 ? `${r.cooldownMinutes} min` : "sem cooldown";
      const replyLabel = r.useUrlButton ? "🔘 Botão pro privado" : r.replyToTrigger ? "↩ Reply" : "Mensagem solta";
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

export async function refreshRules() {
  try {
    const r = await fetch("/rules");
    const { rules } = await r.json();
    state.allRules = rules;
    renderRules();
  } catch (err) {
    console.error("refreshRules falhou:", err);
  }
}

export function openRuleModal(id) {
  state.editingRuleId = id ?? null;
  const rule = id ? state.allRules.find((r) => r.id === id) : null;

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

  useUrlButtonInput.checked = rule ? !!rule.useUrlButton : false;
  buttonTextInput.value = rule && rule.buttonText ? rule.buttonText : "";
  applyUrlButtonVisibility();

  ruleModal.classList.remove("hidden");
  keywordsInput.focus();
}

export function applyUrlButtonVisibility() {
  const usingButton = useUrlButtonInput.checked;
  buttonTextWrap.classList.toggle("hidden", !usingButton);
  ruleReplyModeWrap.classList.toggle("hidden", usingButton);
}

export function closeRuleModal() {
  ruleModal.classList.add("hidden");
  state.editingRuleId = null;
}

export async function saveRule() {
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
  const useUrlButton = useUrlButtonInput.checked;
  const buttonText = buttonTextInput.value.trim() || null;

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
    useUrlButton,
    buttonText,
    enabled,
  };

  ruleSaveBtn.disabled = true;
  try {
    let r;
    if (state.editingRuleId) {
      r = await fetch(`/rules/${encodeURIComponent(state.editingRuleId)}`, {
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

export async function deleteRule(id) {
  if (!confirm("Excluir esta regra?")) return;
  await fetch(`/rules/${encodeURIComponent(id)}`, { method: "DELETE" });
  refreshRules();
}

export function initRules() {
  useUrlButtonInput.addEventListener("change", applyUrlButtonVisibility);
  newRuleBtn.addEventListener("click", () => openRuleModal(null));
  ruleCancelBtn.addEventListener("click", closeRuleModal);
  ruleSaveBtn.addEventListener("click", saveRule);
  ruleModal.addEventListener("click", (e) => {
    if (e.target === ruleModal) closeRuleModal();
  });
}
