// src/services/keyword.service.ts
import { KEYWORD_RESPONSES, type KeywordResponse } from "../data/keywords";

export class KeywordService {
  /**
   * Verifica se uma mensagem contém uma palavra-chave e retorna a regra correspondente.
   */
  public findMatchingResponse(message: string): KeywordResponse | undefined {
    const lowerCaseMessage = message.toLowerCase();

    for (const rule of KEYWORD_RESPONSES) {
      const hasKeyword = rule.keywords.some((keyword) =>
        lowerCaseMessage.includes(keyword.toLowerCase())
      );
      if (hasKeyword) return rule;
    }
    return undefined;
  }
}