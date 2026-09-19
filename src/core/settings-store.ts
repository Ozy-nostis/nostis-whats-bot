import { JsonFileStore } from "./base-store";
import { extractPhoneKey, phoneKeysMatch } from "../utils/jid";
import { PATHS } from "../config/paths";

export interface Settings {
  /** Ignora por completo mensagens de quem tem "ADM" no nome do WhatsApp. */
  ignoreAdminNames: boolean;
  /** Números (só dígitos) que disparam a regra normalmente, mas não recebem a resposta de texto. */
  noReplyNumbers: string[];
}

export interface SettingsInput {
  ignoreAdminNames?: boolean;
  noReplyNumbers?: string[];
}

const DEFAULT_SETTINGS: Settings = {
  ignoreAdminNames: false,
  noReplyNumbers: [],
};

function normalizeNumbers(list: string[]): string[] {
  return [...new Set(list.map((n) => n.replace(/\D/g, "")).filter(Boolean))];
}

class SettingsStore extends JsonFileStore<Settings> {
  constructor() {
    super(PATHS.settings, { ...DEFAULT_SETTINGS });
    this.data.noReplyNumbers = normalizeNumbers(this.data.noReplyNumbers ?? []);
  }

  get(): Settings {
    return this.data;
  }

  update(input: SettingsInput): Settings {
    if (input.ignoreAdminNames !== undefined) this.data.ignoreAdminNames = input.ignoreAdminNames;
    if (input.noReplyNumbers !== undefined) this.data.noReplyNumbers = normalizeNumbers(input.noReplyNumbers);
    this.save();
    return this.data;
  }

  isNoReplyNumber(phoneDigits: string): boolean {
    const incoming = extractPhoneKey(phoneDigits);
    return this.data.noReplyNumbers.some((stored) =>
      phoneKeysMatch(extractPhoneKey(stored), incoming)
    );
  }
}

export const settingsStore = new SettingsStore();
