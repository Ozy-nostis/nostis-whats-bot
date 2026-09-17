const statusEl = document.getElementById("status");
const onBtn = document.getElementById("on");
const offBtn = document.getElementById("off");
const listEl = document.getElementById("groups-list");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("groups-count");

let allGroups = [];
let enabledSet = new Set();

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
    const { active } = await r.json();
    statusEl.textContent = active ? "ATIVO" : "DESLIGADO";
    statusEl.className = "status " + (active ? "on" : "off");
    onBtn.disabled = active;
    offBtn.disabled = !active;
  } catch (err) {
    console.error("refreshStatus falhou:", err);
    statusEl.textContent = "SEM CONEXÃO";
    statusEl.className = "status off";
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

onBtn.addEventListener("click", async () => {
  await fetch("/on", { method: "POST" });
  refreshStatus();
});

offBtn.addEventListener("click", async () => {
  await fetch("/off", { method: "POST" });
  refreshStatus();
});

searchEl.addEventListener("input", () => renderGroups(searchEl.value));

// Inicialização
refreshStatus();
refreshGroups();
setInterval(refreshStatus, 2000);
setInterval(refreshGroups, 10000);