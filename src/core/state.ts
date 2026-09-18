import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface GroupInfo {
  jid: string;
  name: string;
  hasPicture: boolean;
}

interface PersistedState {
  active: boolean;
  enabledGroups: string[];
}

const STATE_FILE = join(process.cwd(), "src", "data", "state.json");

class BotState {
  private _active = true;
  private _groups: GroupInfo[] = [];
  private _enabledGroups = new Set<string>();
  // Timestamp (segundos, igual ao messageTimestamp do WhatsApp) do momento em
  // que o bot passou a ficar ativo. Mensagens com timestamp anterior a este
  // valor são backlog (histórico/offline) e não devem gerar resposta.
  private _activatedAt = Math.floor(Date.now() / 1000);

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(STATE_FILE)) return;
    try {
      const raw = readFileSync(STATE_FILE, "utf-8");
      const data = JSON.parse(raw) as PersistedState;
      this._active = data.active ?? true;
      this._enabledGroups = new Set(data.enabledGroups ?? []);
    } catch (err) {
      console.error("Falha ao carregar state.json:", err);
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(STATE_FILE), { recursive: true });
      const data: PersistedState = {
        active: this._active,
        enabledGroups: [...this._enabledGroups],
      };
      writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Falha ao salvar state.json:", err);
    }
  }

  get active(): boolean {
    return this._active;
  }

  get activatedAt(): number {
    return this._activatedAt;
  }

  enable(): void {
    this._active = true;
    this._activatedAt = Math.floor(Date.now() / 1000);
    this.save();
  }

  disable(): void {
    this._active = false;
    this.save();
  }

  get groups(): GroupInfo[] {
    return this._groups;
  }

  setGroups(groups: GroupInfo[]): void {
    this._groups = groups;
    let changed = false;
    for (const jid of [...this._enabledGroups]) {
      if (!groups.some((g) => g.jid === jid)) {
        this._enabledGroups.delete(jid);
        changed = true;
      }
    }
    if (changed) this.save();
  }

  isGroupEnabled(jid: string): boolean {
    return this._enabledGroups.has(jid);
  }

  setGroupEnabled(jid: string, enabled: boolean): void {
    if (enabled) this._enabledGroups.add(jid);
    else this._enabledGroups.delete(jid);
    this.save();
  }

  enableAllGroups(): void {
    this._enabledGroups = new Set(this._groups.map((g) => g.jid));
    this.save();
  }

  disableAllGroups(): void {
    this._enabledGroups.clear();
    this.save();
  }

  get enabledGroups(): string[] {
    return [...this._enabledGroups];
  }
}

export const botState = new BotState();