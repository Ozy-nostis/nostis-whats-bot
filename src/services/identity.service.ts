import type { WASocket, WAMessage } from "baileys-joss";

export class IdentityService {
  /**
   * Resolve o participante de uma mensagem de grupo pro JID de telefone real.
   * Quando o WhatsApp usa LID (identidade oculta), tenta primeiro o campo
   * `participantAlt` (já vem resolvido pelo próprio baileys) e só recorre à
   * consulta assíncrona se precisar.
   */
  public async resolveParticipantJid(
    sock: WASocket,
    msg: WAMessage,
    remoteJid: string
  ): Promise<string> {
    const participant = msg.key.participant ?? remoteJid;
    if (!participant.endsWith("@lid")) return participant;
    if (msg.key.participantAlt) return msg.key.participantAlt;

    try {
      const resolved = await sock.signalRepository.lidMapping.getPNForLID(participant);
      if (resolved) return resolved;
    } catch (err) {
      console.error("Falha ao resolver LID pro número real:", err);
    }

    return participant;
  }
}

export const identityService = new IdentityService();
