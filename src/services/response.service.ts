import type { WASocket, WAMessage } from "baileys-joss";
import { generateUrlButtonMessage, generateMessageIDV2 } from "baileys-joss";
import { DEFAULT_BUTTON_TEXT, type KeywordRule } from "../core/keyword-store";
import { NotificationService } from "./notification.service";
import { phoneFromJid } from "../utils/jid";
import { sleep } from "../utils/sleep";
import { logger } from "../utils/logger";

export class ResponseService {
  private notificationService = new NotificationService();

  /** Reage à mensagem-gatilho com emoji */
  public async sendReaction(
    sock: WASocket,
    remoteJid: string,
    emoji: string,
    msgKey: WAMessage["key"]
  ): Promise<void> {
    try {
      await sock.sendMessage(remoteJid, {
        react: { text: emoji, key: msgKey },
      });
    } catch (err) {
      logger.error({ err, remoteJid }, "Falha ao reagir na mensagem-gatilho");
    }
  }

  /**
   * Envia a resposta automática com delay programado (se houver), citando a
   * mensagem original ou enviando botão interativo conforme a regra.
   */
  public async sendDelayedResponse(
    sock: WASocket,
    remoteJid: string,
    text: string,
    rule: KeywordRule,
    triggerMsg: WAMessage,
    delayMs: number,
    groupName: string
  ): Promise<void> {
    if (delayMs > 0) await sleep(delayMs);

    try {
      if (rule.useUrlButton) {
        await this.sendUrlButtonResponse(sock, remoteJid, text, rule.buttonText);
      } else {
        await sock.sendMessage(
          remoteJid,
          { text },
          rule.replyToTrigger ? { quoted: triggerMsg } : {}
        );
      }

      await this.notificationService.send(
        "Mensagem Enviada",
        `Respondido no grupo ${groupName}: "${text}"`
      );

      logger.info(`Resposta enviada para ${groupName}: "${text}"`);
    } catch (err) {
      logger.error({ err, remoteJid }, "Falha ao enviar resposta automática");
    }
  }

  /**
   * Manda a resposta como botão de URL apontando pro privado do próprio bot
   * (https://wa.me/<número>). Usa relayMessage com interactiveMessage.
   */
  public async sendUrlButtonResponse(
    sock: WASocket,
    remoteJid: string,
    body: string,
    buttonText: string | null
  ): Promise<void> {
    const ownNumber = phoneFromJid(sock.user?.phoneNumber ?? sock.user?.id ?? "");
    const content = generateUrlButtonMessage(body, [
      { displayText: buttonText || DEFAULT_BUTTON_TEXT, url: `https://wa.me/${ownNumber}` },
    ]);
    const messageId = generateMessageIDV2(sock.user?.id);
    await sock.relayMessage(remoteJid, content, { messageId });
  }
}

export const responseService = new ResponseService();
