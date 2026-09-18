import { readFileSync } from "fs";
import type { WASocket } from "baileys-joss";
import { campaignStore, type Campaign } from "../core/campaign-store";
import { botState } from "../core/state";
import { logger } from "../utils/logger";

export interface CampaignSendResult {
  jid: string;
  groupName: string;
  ok: boolean;
  error?: string;
}

export interface CampaignSendState {
  status: "idle" | "sending" | "done";
  total: number;
  sent: number;
  results: CampaignSendResult[];
  startedAt: number | null;
  finishedAt: number | null;
}

const sendStates = new Map<string, CampaignSendState>();

function idleState(): CampaignSendState {
  return { status: "idle", total: 0, sent: 0, results: [], startedAt: null, finishedAt: null };
}

export function getSendState(campaignId: string): CampaignSendState {
  return sendStates.get(campaignId) ?? idleState();
}

export function isSending(campaignId: string): boolean {
  return sendStates.get(campaignId)?.status === "sending";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia a campanha para cada grupo, com um intervalo entre mensagens para
 * reduzir o risco de o número ser marcado como spam pelo WhatsApp.
 * Roda em segundo plano; o progresso é consultado via getSendState().
 */
export async function sendCampaign(sock: WASocket, campaign: Campaign): Promise<void> {
  if (isSending(campaign.id)) return;

  const state: CampaignSendState = {
    status: "sending",
    total: campaign.groupJids.length,
    sent: 0,
    results: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
  sendStates.set(campaign.id, state);

  const mediaPath = campaignStore.getMediaPath(campaign);
  const mediaBuffer = mediaPath ? readFileSync(mediaPath) : null;

  for (let i = 0; i < campaign.groupJids.length; i++) {
    const jid = campaign.groupJids[i]!;
    const groupName = botState.groups.find((g) => g.jid === jid)?.name ?? jid;

    try {
      if (campaign.mediaType === "sticker" && mediaBuffer) {
        await sock.sendMessage(jid, { sticker: mediaBuffer });
        if (campaign.message) {
          await sock.sendMessage(jid, { text: campaign.message });
        }
      } else if (campaign.mediaType === "image" && mediaBuffer) {
        await sock.sendMessage(jid, {
          image: mediaBuffer,
          caption: campaign.message || undefined,
        });
      } else {
        await sock.sendMessage(jid, { text: campaign.message });
      }
      state.results.push({ jid, groupName, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, jid }, "Falha ao enviar propaganda para grupo");
      state.results.push({ jid, groupName, ok: false, error: message });
    }

    state.sent++;

    const isLast = i === campaign.groupJids.length - 1;
    if (!isLast) await sleep(campaign.intervalSeconds * 1000);
  }

  state.status = "done";
  state.finishedAt = Date.now();
}
