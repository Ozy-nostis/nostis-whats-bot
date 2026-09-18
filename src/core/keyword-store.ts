import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

export interface KeywordRule {
  id: string;
  keywords: string[];
  responses: string[];
  cooldownMinutes: number;
  /** true = responde citando (reply) a mensagem que gerou o gatilho; false = manda solto no grupo */
  replyToTrigger: boolean;
  /** Emoji de reação enviado na mensagem-gatilho (além da resposta em texto), ou null pra não reagir */
  reactionEmoji: string | null;
  /** Registra métricas (grupo, pessoa, horário) toda vez que essa regra dispara */
  trackMetrics: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface KeywordRuleInput {
  keywords: string[];
  responses: string[];
  cooldownMinutes?: number;
  replyToTrigger?: boolean;
  reactionEmoji?: string | null;
  trackMetrics?: boolean;
  enabled?: boolean;
}

/** Conjunto fixo de reações disponíveis na dashboard. */
export const ALLOWED_REACTIONS = ["❤️", "👍", "🙏", "🚀", "🔥"] as const;

function normalizeReaction(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  if (!(ALLOWED_REACTIONS as readonly string[]).includes(emoji)) {
    throw new Error(`Reação inválida: "${emoji}". Use uma das opções disponíveis.`);
  }
  return emoji;
}

const RULES_FILE = join(process.cwd(), "src", "data", "keyword-rules.json");

// Regra padrão preservada da configuração original, usada apenas se ainda
// não existir nenhum arquivo de regras salvo.
const DEFAULT_RULES: KeywordRule[] = [
  {
    id: randomUUID(),
    keywords: ["uber on"],
    responses: ["On, chama pv", "pv", "Chama pv"],
    cooldownMinutes: 0,
    replyToTrigger: true,
    reactionEmoji: null,
    trackMetrics: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

function normalizeList(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

class KeywordStore {
  private rules: KeywordRule[] = [];
  private lastTriggered = new Map<string, number>();

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(RULES_FILE)) {
      this.rules = DEFAULT_RULES;
      this.save();
      return;
    }
    try {
      const raw = readFileSync(RULES_FILE, "utf-8");
      const parsed = JSON.parse(raw) as KeywordRule[];
      // Migra regras salvas antes dos campos replyToTrigger/reactionEmoji/trackMetrics
      // existirem, preservando o comportamento anterior (sempre citava, nunca reagia
      // ou rastreava métricas).
      this.rules = parsed.map((rule) => ({
        ...rule,
        replyToTrigger: rule.replyToTrigger ?? true,
        reactionEmoji: rule.reactionEmoji ?? null,
        trackMetrics: rule.trackMetrics ?? false,
      }));
    } catch (err) {
      console.error("Falha ao carregar keyword-rules.json:", err);
      this.rules = [];
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(RULES_FILE), { recursive: true });
      writeFileSync(RULES_FILE, JSON.stringify(this.rules, null, 2), "utf-8");
    } catch (err) {
      console.error("Falha ao salvar keyword-rules.json:", err);
    }
  }

  list(): KeywordRule[] {
    return this.rules;
  }

  get(id: string): KeywordRule | undefined {
    return this.rules.find((rule) => rule.id === id);
  }

  create(input: KeywordRuleInput): KeywordRule {
    const now = Date.now();
    const rule: KeywordRule = {
      id: randomUUID(),
      keywords: normalizeList(input.keywords),
      responses: normalizeList(input.responses),
      cooldownMinutes: Math.max(0, input.cooldownMinutes ?? 0),
      replyToTrigger: input.replyToTrigger ?? true,
      reactionEmoji: normalizeReaction(input.reactionEmoji),
      trackMetrics: input.trackMetrics ?? false,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.rules.push(rule);
    this.save();
    return rule;
  }

  update(id: string, input: Partial<KeywordRuleInput>): KeywordRule | undefined {
    const rule = this.get(id);
    if (!rule) return undefined;

    if (input.keywords) rule.keywords = normalizeList(input.keywords);
    if (input.responses) rule.responses = normalizeList(input.responses);
    if (input.cooldownMinutes !== undefined) {
      rule.cooldownMinutes = Math.max(0, input.cooldownMinutes);
    }
    if (input.replyToTrigger !== undefined) rule.replyToTrigger = input.replyToTrigger;
    if (input.reactionEmoji !== undefined) rule.reactionEmoji = normalizeReaction(input.reactionEmoji);
    if (input.trackMetrics !== undefined) rule.trackMetrics = input.trackMetrics;
    if (input.enabled !== undefined) rule.enabled = input.enabled;
    rule.updatedAt = Date.now();

    this.save();
    return rule;
  }

  delete(id: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((rule) => rule.id !== id);
    if (this.rules.length === before) return false;
    this.save();
    return true;
  }

  /**
   * Retorna a primeira regra ativa cuja mensagem seja EXATAMENTE igual (sem
   * diferenciar maiúsculas/minúsculas) a uma das palavras-chave cadastradas.
   * Não é correspondência parcial: a mensagem não pode ter nada a mais nem a menos.
   */
  findMatch(message: string): KeywordRule | undefined {
    const normalized = message.trim().toLowerCase();
    return this.rules.find(
      (rule) =>
        rule.enabled &&
        rule.keywords.length > 0 &&
        rule.keywords.some((keyword) => normalized === keyword.trim().toLowerCase())
    );
  }

  /** Cooldown é isolado por regra + grupo, então um grupo não bloqueia o outro. */
  isOnCooldown(ruleId: string, jid: string): boolean {
    const rule = this.get(ruleId);
    if (!rule || rule.cooldownMinutes <= 0) return false;

    const last = this.lastTriggered.get(`${ruleId}:${jid}`);
    if (!last) return false;

    return Date.now() - last < rule.cooldownMinutes * 60_000;
  }

  markTriggered(ruleId: string, jid: string): void {
    this.lastTriggered.set(`${ruleId}:${jid}`, Date.now());
  }
}

export const keywordStore = new KeywordStore();
