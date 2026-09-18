// src/services/keyword.service.ts
import { keywordStore, type KeywordRule } from "../core/keyword-store";

export class KeywordService {
  /**
   * Verifica se uma mensagem bate com alguma regra ativa e fora do cooldown
   * para o grupo informado.
   */
  public findMatchingResponse(message: string, jid: string): KeywordRule | undefined {
    const rule = keywordStore.findMatch(message);
    if (!rule) return undefined;
    if (keywordStore.isOnCooldown(rule.id, jid)) return undefined;
    return rule;
  }

  public markTriggered(ruleId: string, jid: string): void {
    keywordStore.markTriggered(ruleId, jid);
  }
}
