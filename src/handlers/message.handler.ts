import type { WASocket, proto, WAMessage } from "baileys-joss";
import { toNumber } from "baileys-joss";
import { KeywordService } from "../services/keyword.service";
import { NotificationService } from "../services/notification.service";
import { StickerCollectorService } from "../services/sticker-collector.service";
import { botState } from "../core/state";
import { callLeadStore } from "../core/lead-store";

export class MessageHandler {
  private keywordService = new KeywordService();
  private notificationService = new NotificationService();
  private stickerCollector = new StickerCollectorService();

  public async handle(sock: WASocket, msg: proto.IWebMessageInfo): Promise<void> {
    if (!msg.key || msg.key.fromMe) return;

    // Ignora backlog: histórico e mensagens que chegaram enquanto o bot
    // estava desconectado/inativo não devem gerar resposta quando ele
    // (re)conectar ou for reativado.
    const messageTimestamp = toNumber(msg.messageTimestamp);
    if (messageTimestamp && messageTimestamp < botState.activatedAt) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    if (!remoteJid.endsWith("@g.us")) {
      // Mensagem privada: correlaciona com o gatilho mais recente dessa pessoa,
      // se houver, pra alimentar as métricas de "chamou no privado".
      callLeadStore.markPrivateContact(remoteJid);
      return;
    }

    // Coleta de figurinhas roda independente do bot estar ligado/desligado para
    // respostas automáticas, pra alimentar a galeria usada nas campanhas de propaganda.
    if (msg.message?.stickerMessage) {
      void this.stickerCollector.collect(sock, msg, remoteJid);
    }

    if (!botState.active) return;
    if (!botState.isGroupEnabled(remoteJid)) return;

    const messageText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    if (!messageText) return;

    const rule = this.keywordService.findMatchingResponse(messageText, remoteJid);
    if (!rule) return;

    const groupName =
      botState.groups.find((g) => g.jid === remoteJid)?.name ?? remoteJid;

    if (rule.trackMetrics) {
      callLeadStore.recordTrigger({
        ruleId: rule.id,
        groupJid: remoteJid,
        groupName,
        callerJid: msg.key.participant ?? remoteJid,
        callerName: msg.pushName ?? null,
      });
    }

    if (rule.reactionEmoji) {
      try {
        await sock.sendMessage(remoteJid, {
          react: { text: rule.reactionEmoji, key: msg.key },
        });
      } catch (err) {
        console.error("Falha ao reagir na mensagem-gatilho:", err);
      }
    }

    const randomResponse =
      rule.responses[Math.floor(Math.random() * rule.responses.length)];

    await sock.sendMessage(
      remoteJid,
      { text: randomResponse },
      rule.replyToTrigger ? { quoted: msg as WAMessage } : {}
    );

    this.keywordService.markTriggered(rule.id, remoteJid);

    await this.notificationService.send(
      "Mensagem Enviada",
      `Respondido no grupo ${groupName}: "${randomResponse}"`
    );

    console.log(`Resposta enviada para ${groupName}: ${randomResponse}`);
  }
}