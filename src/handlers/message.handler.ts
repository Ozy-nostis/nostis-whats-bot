import type { WASocket, WAMessage } from "baileys-joss";
import { toNumber } from "baileys-joss";
import { KeywordService } from "../services/keyword.service";
import { StickerCollectorService } from "../services/sticker-collector.service";
import { responseService } from "../services/response.service";
import { identityService } from "../services/identity.service";
import { botState } from "../core/state";
import { callLeadStore } from "../core/lead-store";
import { settingsStore } from "../core/settings-store";
import { banStore } from "../core/ban-store";
import { callerStore } from "../core/caller-store";
import { groupDelayStore } from "../core/group-delay-store";
import { phoneFromJid } from "../utils/jid";
import { CONFIG } from "../config";
import { logger } from "../utils/logger";

function nameLooksLikeAdmin(pushName: string | null | undefined): boolean {
  if (!pushName) return false;
  return /adm/i.test(pushName);
}

export class MessageHandler {
  private keywordService = new KeywordService();
  private stickerCollector = new StickerCollectorService();

  public async handle(sock: WASocket, msg: WAMessage): Promise<void> {
    if (!msg.key || msg.key.fromMe) return;

    // Ignora backlog: histórico e mensagens que chegaram enquanto o bot estava desconectado/inativo
    const messageTimestamp = toNumber(msg.messageTimestamp);
    if (messageTimestamp && messageTimestamp < botState.activatedAt) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    if (!remoteJid.endsWith("@g.us")) {
      // Mensagem privada de alguém banido: avisa e não processa como contato normal
      if (banStore.isBanned(remoteJid)) {
        try {
          await sock.sendMessage(remoteJid, { text: CONFIG.banWarningMessage });
        } catch (err) {
          logger.error({ err }, "Falha ao avisar número banido");
        }
        return;
      }

      // Mensagem privada: correlaciona com métricas e registra contato
      callLeadStore.markPrivateContact(remoteJid);
      callerStore.registerCall(remoteJid, msg.pushName ?? null);
      return;
    }

    // Resolve LID para telefone real
    const participantJid = await identityService.resolveParticipantJid(sock, msg, remoteJid);

    // Pessoa banida: ignora
    if (banStore.isBanned(participantJid)) return;

    // Ignora nomes de administrador caso configurado
    if (settingsStore.get().ignoreAdminNames && nameLooksLikeAdmin(msg.pushName)) return;

    // Coleta figurinhas vistas para a galeria
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
        callerJid: participantJid,
        callerName: msg.pushName ?? null,
      });
      callerStore.registerCall(participantJid, msg.pushName ?? null);
    }

    if (rule.reactionEmoji) {
      void responseService.sendReaction(sock, remoteJid, rule.reactionEmoji, msg.key);
    }

    this.keywordService.markTriggered(rule.id, remoteJid);

    // Número na lista "sem resposta": conta gatilho/métrica mas não envia texto
    if (!settingsStore.isNoReplyNumber(phoneFromJid(participantJid))) {
      const randomResponse =
        rule.responses[Math.floor(Math.random() * rule.responses.length)];

      void responseService.sendDelayedResponse(
        sock,
        remoteJid,
        randomResponse,
        rule,
        msg,
        groupDelayStore.get(remoteJid),
        groupName
      );
    }
  }
}
