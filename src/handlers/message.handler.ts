import type { WASocket, proto, WAMessage } from "baileys-joss";
import { KeywordService } from "../services/keyword.service";
import { NotificationService } from "../services/notification.service";
import { botState } from "../core/state";

export class MessageHandler {
  private keywordService = new KeywordService();
  private notificationService = new NotificationService();

  public async handle(sock: WASocket, msg: proto.IWebMessageInfo): Promise<void> {
    if (!botState.active) return;
    if (!msg.key || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || !remoteJid.endsWith("@g.us")) return;
    if (!botState.isGroupEnabled(remoteJid)) return;

    const messageText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    if (!messageText) return;

    const rule = this.keywordService.findMatchingResponse(messageText);
    if (!rule) return;

    const randomResponse =
      rule.responses[Math.floor(Math.random() * rule.responses.length)];

    await sock.sendMessage(
      remoteJid,
      { text: randomResponse },
      { quoted: msg as WAMessage }
    );

    const groupName =
      botState.groups.find((g) => g.jid === remoteJid)?.name ?? remoteJid;

    await this.notificationService.send(
      "Mensagem Enviada",
      `Respondido no grupo ${groupName}: "${randomResponse}"`
    );

    console.log(`Resposta enviada para ${groupName}: ${randomResponse}`);
  }
}