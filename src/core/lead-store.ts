import { JsonFileStore } from "./base-store";
import { randomUUID } from "crypto";
import { normalizeJid } from "../utils/jid";
import { PATHS } from "../config/paths";
import { CONFIG } from "../config";

export type LeadStatus = "pending" | "closed" | "not_closed";

export interface CallLead {
  id: string;
  ruleId: string;
  groupJid: string;
  groupName: string;
  callerJid: string;
  callerName: string | null;
  triggeredAt: number;
  privateContactAt: number | null;
  value: number | null;
  status: LeadStatus;
  updatedAt: number;
}

export interface RecordTriggerInput {
  ruleId: string;
  groupJid: string;
  groupName: string;
  callerJid: string;
  callerName: string | null;
}

export interface LeadUpdateInput {
  value?: number | null;
  status?: LeadStatus;
}

const STATUSES: readonly LeadStatus[] = ["pending", "closed", "not_closed"];

class CallLeadStore extends JsonFileStore<CallLead[]> {
  constructor() {
    super(PATHS.callLeads, []);
  }

  list(): CallLead[] {
    return this.data;
  }

  get(id: string): CallLead | undefined {
    return this.data.find((l) => l.id === id);
  }

  /** Chamado quando uma regra com rastreamento ativo dispara num grupo. */
  recordTrigger(input: RecordTriggerInput): CallLead {
    const now = Date.now();
    const lead: CallLead = {
      id: randomUUID(),
      ruleId: input.ruleId,
      groupJid: input.groupJid,
      groupName: input.groupName,
      callerJid: normalizeJid(input.callerJid),
      callerName: input.callerName,
      triggeredAt: now,
      privateContactAt: null,
      value: null,
      status: "pending",
      updatedAt: now,
    };

    this.data.unshift(lead);
    if (this.data.length > CONFIG.maxLeads) {
      this.data.splice(CONFIG.maxLeads);
    }

    this.save();
    return lead;
  }

  /**
   * Chamado quando chega uma mensagem privada. Correlaciona com o gatilho mais
   * recente ainda não vinculado da mesma pessoa, dentro da janela de tempo.
   * Não faz nada (silenciosamente) se não houver gatilho pendente pra esse JID.
   */
  markPrivateContact(callerJid: string): CallLead | undefined {
    const normalized = normalizeJid(callerJid);
    const now = Date.now();

    const lead = this.data.find(
      (l) =>
        l.callerJid === normalized &&
        l.privateContactAt === null &&
        now - l.triggeredAt <= CONFIG.correlationWindowMs
    );
    if (!lead) return undefined;

    lead.privateContactAt = now;
    lead.updatedAt = now;
    this.save();
    return lead;
  }

  update(id: string, input: LeadUpdateInput): CallLead | undefined {
    const lead = this.get(id);
    if (!lead) return undefined;

    if (input.value !== undefined) {
      lead.value = input.value === null ? null : Math.max(0, input.value);
    }
    if (input.status !== undefined) {
      if (!STATUSES.includes(input.status)) {
        throw new Error(`Status inválido: "${input.status}".`);
      }
      lead.status = input.status;
    }
    lead.updatedAt = Date.now();

    this.save();
    return lead;
  }

  delete(id: string): boolean {
    const before = this.data.length;
    this.data = this.data.filter((l) => l.id !== id);
    if (this.data.length === before) return false;
    this.save();
    return true;
  }
}

export const callLeadStore = new CallLeadStore();
