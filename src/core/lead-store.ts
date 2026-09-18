import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

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

const LEADS_FILE = join(process.cwd(), "src", "data", "call-leads.json");

/** Limite pra não deixar o histórico crescer sem controle. */
const MAX_LEADS = 500;

/** Uma mensagem privada só é correlacionada a um gatilho disparado nas últimas 24h. */
const CORRELATION_WINDOW_MS = 24 * 60 * 60 * 1000;

const STATUSES: readonly LeadStatus[] = ["pending", "closed", "not_closed"];

/**
 * Remove o sufixo de dispositivo (ex: ":12") que o WhatsApp às vezes anexa à
 * parte do usuário do JID, preservando o domínio (@s.whatsapp.net / @lid / etc).
 * Ex: "5511999990000:12@s.whatsapp.net" -> "5511999990000@s.whatsapp.net"
 */
function normalizeJid(jid: string): string {
  const [userPart, domain] = jid.split("@");
  const cleanUser = userPart!.split(":")[0];
  return domain ? `${cleanUser}@${domain}` : cleanUser!;
}

class CallLeadStore {
  private leads: CallLead[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(LEADS_FILE)) {
      this.leads = [];
      return;
    }
    try {
      this.leads = JSON.parse(readFileSync(LEADS_FILE, "utf-8")) as CallLead[];
    } catch (err) {
      console.error("Falha ao carregar call-leads.json:", err);
      this.leads = [];
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(LEADS_FILE), { recursive: true });
      writeFileSync(LEADS_FILE, JSON.stringify(this.leads, null, 2), "utf-8");
    } catch (err) {
      console.error("Falha ao salvar call-leads.json:", err);
    }
  }

  list(): CallLead[] {
    return this.leads;
  }

  get(id: string): CallLead | undefined {
    return this.leads.find((l) => l.id === id);
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

    this.leads.unshift(lead);
    if (this.leads.length > MAX_LEADS) {
      this.leads.splice(MAX_LEADS);
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

    const lead = this.leads.find(
      (l) =>
        l.callerJid === normalized &&
        l.privateContactAt === null &&
        now - l.triggeredAt <= CORRELATION_WINDOW_MS
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
    const before = this.leads.length;
    this.leads = this.leads.filter((l) => l.id !== id);
    if (this.leads.length === before) return false;
    this.save();
    return true;
  }
}

export const callLeadStore = new CallLeadStore();
