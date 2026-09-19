import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { profileStore } from "./profile-store";

export interface GroupInfo {
  jid: string;
  name: string;
  hasPicture: boolean;
}

interface GlobalPersistedState {
  active: boolean;
}

import { PATHS } from "../config/paths";

interface ProfileGroupsState {
  enabledGroups: string[];
}

// "active" (bot ligado/desligado) é global, vale independente do perfil ativo.
const STATE_FILE = PATHS.state;

class BotState {
  private _active = true;
  private _groups: GroupInfo[] = [];
  // enabledGroups é por perfil: cada preset lembra quais grupos habilitou.
  private _enabledGroups = new Set<string>();
  // Timestamp (segundos, igual ao messageTimestamp do WhatsApp) do momento em
  // que o bot passou a ficar ativo. Mensagens com timestamp anterior a este
  // valor são backlog (histórico/offline) e não devem gerar resposta.
  private _activatedAt = Math.floor(Date.now() / 1000);

  constructor() {
    this.loadGlobal();
    this.loadGroupsForActiveProfile();
  }

  private loadGlobal(): void {
    if (!existsSync(STATE_FILE)) return;
    try {
      const raw = readFileSync(STATE_FILE, "utf-8");
      const data = JSON.parse(raw) as GlobalPersistedState;
      this._active = data.active ?? true;
    } catch (err) {
      console.error("Falha ao carregar state.json:", err);
    }
  }

  private saveGlobal(): void {
    try {
      mkdirSync(dirname(STATE_FILE), { recursive: true });
      const data: GlobalPersistedState = { active: this._active };
      writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Falha ao salvar state.json:", err);
    }
  }

  private groupsFile(): string {
    return join(profileStore.activeDir(), "groups.json");
  }

  private loadGroupsForActiveProfile(): void {
    const file = this.groupsFile();
    if (!existsSync(file)) {
      this._enabledGroups = new Set();
      return;
    }
    try {
      const raw = readFileSync(file, "utf-8");
      const data = JSON.parse(raw) as ProfileGroupsState;
      this._enabledGroups = new Set(data.enabledGroups ?? []);
    } catch (err) {
      console.error("Falha ao carregar groups.json do perfil:", err);
      this._enabledGroups = new Set();
    }
  }

  private saveGroups(): void {
    try {
      const file = this.groupsFile();
      mkdirSync(dirname(file), { recursive: true });
      const data: ProfileGroupsState = { enabledGroups: [...this._enabledGroups] };
      writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Falha ao salvar groups.json do perfil:", err);
    }
  }

  /** Recarrega os grupos habilitados do perfil atualmente ativo (chamado ao trocar/importar perfil). */
  reloadGroupsForProfile(): void {
    this.loadGroupsForActiveProfile();
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
    this.saveGlobal();
  }

  disable(): void {
    this._active = false;
    this.saveGlobal();
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
    if (changed) this.saveGroups();
  }

  isGroupEnabled(jid: string): boolean {
    return this._enabledGroups.has(jid);
  }

  setGroupEnabled(jid: string, enabled: boolean): void {
    if (enabled) this._enabledGroups.add(jid);
    else this._enabledGroups.delete(jid);
    this.saveGroups();
  }

  enableAllGroups(): void {
    this._enabledGroups = new Set(this._groups.map((g) => g.jid));
    this.saveGroups();
  }

  disableAllGroups(): void {
    this._enabledGroups.clear();
    this.saveGroups();
  }

  get enabledGroups(): string[] {
    return [...this._enabledGroups];
  }
}

export const botState = new BotState();
