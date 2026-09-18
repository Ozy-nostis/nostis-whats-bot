import { join } from "path";
import { botState } from "./state";
import { getSock, refreshGroups, isWhatsAppConnected } from "./connection";
import { keywordStore, type KeywordRuleInput } from "./keyword-store";
import { campaignStore, type CampaignInput } from "./campaign-store";
import { sendCampaign, getSendState, isSending } from "../services/campaign.service";
import { stickerLibrary } from "./sticker-library";
import { callLeadStore, type LeadUpdateInput } from "./lead-store";
import { logger } from "../utils/logger";

// Em `bun run`, import.meta.dir é a pasta real do arquivo (src/core), então
// precisa subir um nível até src/web. Já no executável compilado, todo módulo
// bundlado compartilha uma raiz virtual única e os assets embutidos via
// --asset=src/web ficam diretamente em "web" nessa raiz (sem o prefixo "src").
const WEB_DIR = Bun.isStandaloneExecutable
  ? join(import.meta.dir, "web")
  : join(import.meta.dir, "..", "web");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function serveFile(filename: string): Promise<Response> {
  const filePath = join(WEB_DIR, filename);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }

  const ext = filename.slice(filename.lastIndexOf("."));
  const headers = { "Content-Type": MIME[ext] ?? "application/octet-stream" };

  return new Response(file, { headers });
}

export function startDashboard(port = 3000): void {
  Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);

      // --- Status global ---
      if (url.pathname === "/status") {
        return Response.json({
          active: botState.active,
          whatsappConnected: isWhatsAppConnected(),
        });
      }

      if (url.pathname === "/on" && req.method === "POST") {
        botState.enable();
        logger.info("Bot LIGADO via dashboard");
        return Response.json({ active: true });
      }

      if (url.pathname === "/off" && req.method === "POST") {
        botState.disable();
        logger.info("Bot DESLIGADO via dashboard");
        return Response.json({ active: false });
      }

      // --- Grupos ---
      if (url.pathname === "/groups" && req.method === "GET") {
        return Response.json({
          groups: botState.groups,
          enabled: botState.enabledGroups,
        });
      }

      if (url.pathname === "/groups/toggle" && req.method === "POST") {
        const body = (await req.json()) as { jid?: string; enabled?: boolean };
        if (!body.jid || typeof body.enabled !== "boolean") {
          return new Response("Bad request", { status: 400 });
        }
        botState.setGroupEnabled(body.jid, body.enabled);
        return Response.json({ ok: true });
      }

      if (url.pathname === "/groups/select-all" && req.method === "POST") {
        if (botState.groups.length === 0) {
          return Response.json(
            {
              error:
                'Nenhum grupo carregado ainda. Conecte o bot ao WhatsApp e clique em "Atualizar" antes de selecionar todos.',
            },
            { status: 409 }
          );
        }
        botState.enableAllGroups();
        return Response.json({
          groups: botState.groups,
          enabled: botState.enabledGroups,
        });
      }

      if (url.pathname === "/groups/deselect-all" && req.method === "POST") {
        botState.disableAllGroups();
        return Response.json({
          groups: botState.groups,
          enabled: botState.enabledGroups,
        });
      }

      if (url.pathname === "/groups/refresh" && req.method === "POST") {
        if (!isWhatsAppConnected()) {
          return Response.json(
            {
              error:
                "O bot não está conectado ao WhatsApp no momento (aguardando conexão ou QR Code). Conecte-se e tente novamente.",
            },
            { status: 503 }
          );
        }
        try {
          const sock = getSock();
          const groups = await refreshGroups(sock);
          return Response.json({ groups, enabled: botState.enabledGroups });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err }, "Falha ao atualizar grupos via dashboard");
          return Response.json(
            { error: `Falha ao atualizar grupos: ${message}` },
            { status: 500 }
          );
        }
      }

      // --- Regras de resposta automática (gatilho + respostas + cooldown) ---
      if (url.pathname === "/rules" && req.method === "GET") {
        return Response.json({ rules: keywordStore.list() });
      }

      if (url.pathname === "/rules" && req.method === "POST") {
        const body = (await req.json()) as Partial<KeywordRuleInput>;
        if (
          !Array.isArray(body.keywords) ||
          !Array.isArray(body.responses) ||
          body.keywords.filter((k) => String(k).trim()).length === 0 ||
          body.responses.filter((r) => String(r).trim()).length === 0
        ) {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const rule = keywordStore.create({
            keywords: body.keywords,
            responses: body.responses,
            cooldownMinutes: body.cooldownMinutes,
            replyToTrigger: body.replyToTrigger,
            reactionEmoji: body.reactionEmoji,
            trackMetrics: body.trackMetrics,
            enabled: body.enabled,
          });
          return Response.json({ rule });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      }

      const ruleMatch = url.pathname.match(/^\/rules\/([^/]+)$/);
      if (ruleMatch) {
        const id = decodeURIComponent(ruleMatch[1]!);

        if (req.method === "PUT") {
          const body = (await req.json()) as Partial<KeywordRuleInput>;
          try {
            const rule = keywordStore.update(id, body);
            if (!rule) return new Response("Not found", { status: 404 });
            return Response.json({ rule });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ error: message }, { status: 400 });
          }
        }

        if (req.method === "DELETE") {
          const ok = keywordStore.delete(id);
          if (!ok) return new Response("Not found", { status: 404 });
          return Response.json({ ok: true });
        }
      }

      // --- Métricas de chamadas (gatilho no grupo -> contato no privado -> valor/status) ---
      if (url.pathname === "/leads" && req.method === "GET") {
        return Response.json({ leads: callLeadStore.list() });
      }

      const leadMatch = url.pathname.match(/^\/leads\/([^/]+)$/);
      if (leadMatch) {
        const id = decodeURIComponent(leadMatch[1]!);

        if (req.method === "PUT") {
          const body = (await req.json()) as Partial<LeadUpdateInput>;
          try {
            const lead = callLeadStore.update(id, body);
            if (!lead) return new Response("Not found", { status: 404 });
            return Response.json({ lead });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ error: message }, { status: 400 });
          }
        }

        if (req.method === "DELETE") {
          const ok = callLeadStore.delete(id);
          if (!ok) return new Response("Not found", { status: 404 });
          return Response.json({ ok: true });
        }
      }

      // --- Campanhas de propaganda (mensagem/mídia + lista própria de grupos) ---
      if (url.pathname === "/campaigns" && req.method === "GET") {
        return Response.json({ campaigns: campaignStore.list() });
      }

      if (url.pathname === "/campaigns" && req.method === "POST") {
        const body = (await req.json()) as Partial<CampaignInput>;
        if (!body.name?.trim() || !Array.isArray(body.groupJids) || body.groupJids.length === 0) {
          return Response.json(
            { error: "Informe um nome para a campanha e selecione ao menos um grupo de destino." },
            { status: 400 }
          );
        }
        if (!body.message?.trim() && !body.media) {
          return Response.json(
            { error: "Informe uma mensagem ou uma mídia (figurinha/imagem) para a campanha." },
            { status: 400 }
          );
        }
        try {
          const campaign = campaignStore.create({
            name: body.name,
            message: body.message ?? "",
            groupJids: body.groupJids,
            intervalSeconds: body.intervalSeconds,
            media: body.media ?? null,
          });
          return Response.json({ campaign });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      }

      const campaignSendMatch = url.pathname.match(/^\/campaigns\/([^/]+)\/send$/);
      if (campaignSendMatch && req.method === "POST") {
        const id = decodeURIComponent(campaignSendMatch[1]!);
        const campaign = campaignStore.get(id);
        if (!campaign) return new Response("Not found", { status: 404 });

        if (campaign.groupJids.length === 0) {
          return Response.json({ error: "Esta campanha não tem grupos de destino." }, { status: 400 });
        }
        if (!isWhatsAppConnected()) {
          return Response.json(
            { error: "O bot não está conectado ao WhatsApp no momento. Conecte-se e tente novamente." },
            { status: 503 }
          );
        }
        if (isSending(id)) {
          return Response.json({ error: "Esta campanha já está sendo enviada." }, { status: 409 });
        }

        void sendCampaign(getSock(), campaign);
        return Response.json({ started: true });
      }

      const campaignStatusMatch = url.pathname.match(/^\/campaigns\/([^/]+)\/status$/);
      if (campaignStatusMatch && req.method === "GET") {
        const id = decodeURIComponent(campaignStatusMatch[1]!);
        return Response.json(getSendState(id));
      }

      const campaignMediaMatch = url.pathname.match(/^\/campaigns\/([^/]+)\/media$/);
      if (campaignMediaMatch && req.method === "GET") {
        const id = decodeURIComponent(campaignMediaMatch[1]!);
        const campaign = campaignStore.get(id);
        const mediaPath = campaign ? campaignStore.getMediaPath(campaign) : null;
        if (!mediaPath) return new Response("Not found", { status: 404 });

        const file = Bun.file(mediaPath);
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file, {
          headers: { "Content-Type": campaign!.mediaMimeType ?? "application/octet-stream" },
        });
      }

      const campaignMatch = url.pathname.match(/^\/campaigns\/([^/]+)$/);
      if (campaignMatch) {
        const id = decodeURIComponent(campaignMatch[1]!);

        if (req.method === "PUT") {
          const body = (await req.json()) as Partial<CampaignInput>;
          try {
            const campaign = campaignStore.update(id, body);
            if (!campaign) return new Response("Not found", { status: 404 });
            return Response.json({ campaign });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ error: message }, { status: 400 });
          }
        }

        if (req.method === "DELETE") {
          if (isSending(id)) {
            return Response.json(
              { error: "Não é possível excluir uma campanha enquanto ela está sendo enviada." },
              { status: 409 }
            );
          }
          const ok = campaignStore.delete(id);
          if (!ok) return new Response("Not found", { status: 404 });
          return Response.json({ ok: true });
        }
      }

      // --- Galeria de figurinhas vistas automaticamente nos grupos ---
      if (url.pathname === "/stickers" && req.method === "GET") {
        return Response.json({ stickers: stickerLibrary.list() });
      }

      const stickerMediaMatch = url.pathname.match(/^\/stickers\/([^/]+)\/media$/);
      if (stickerMediaMatch && req.method === "GET") {
        const id = decodeURIComponent(stickerMediaMatch[1]!);
        const sticker = stickerLibrary.get(id);
        if (!sticker) return new Response("Not found", { status: 404 });

        const file = Bun.file(stickerLibrary.getMediaPath(sticker));
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file, {
          headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400" },
        });
      }

      const stickerMatch = url.pathname.match(/^\/stickers\/([^/]+)$/);
      if (stickerMatch && req.method === "DELETE") {
        const id = decodeURIComponent(stickerMatch[1]!);
        const ok = stickerLibrary.delete(id);
        if (!ok) return new Response("Not found", { status: 404 });
        return Response.json({ ok: true });
      }

      // --- Foto do grupo (sob demanda, com cache do navegador) ---
      if (url.pathname.startsWith("/groups/picture/")) {
        const jid = decodeURIComponent(
            url.pathname.replace("/groups/picture/", "")
        );
        try {
            const sock = getSock();
            const picUrl = await sock.profilePictureUrl(jid, "image");

            if (!picUrl) {
            return new Response("No picture", { status: 404 });
            }

            const res = await fetch(picUrl);
            const buf = await res.arrayBuffer();
            return new Response(buf, {
            headers: {
                "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
                "Cache-Control": "public, max-age=3600",
            },
            });
        } catch {
            return new Response("No picture", { status: 404 });
        }
      }

      // --- Arquivos estáticos ---
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return serveFile("index.html");
      }
      if (url.pathname === "/style.css") {
        return serveFile("style.css");
      }
      if (url.pathname === "/app.js") {
        return serveFile("app.js");
      }

      return new Response("Not found", { status: 404 });
    },
  });

  logger.info(`Dashboard disponível em http://localhost:${port}`);
}