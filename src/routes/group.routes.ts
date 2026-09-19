import { botState } from "../core/state";
import { groupDelayStore } from "../core/group-delay-store";
import { getSock, refreshGroups, isWhatsAppConnected } from "../core/connection";
import { logger } from "../utils/logger";

export async function handleGroupRoutes(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/groups" && req.method === "GET") {
    return Response.json({
      groups: botState.groups,
      enabled: botState.enabledGroups,
      delays: groupDelayStore.getAll(),
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

  if (url.pathname === "/groups/delay" && req.method === "POST") {
    const body = (await req.json()) as { jid?: string; delayMs?: number };
    if (!body.jid || typeof body.delayMs !== "number" || Number.isNaN(body.delayMs)) {
      return new Response("Bad request", { status: 400 });
    }
    groupDelayStore.set(body.jid, body.delayMs);
    return Response.json({ ok: true, delayMs: groupDelayStore.get(body.jid) });
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

  if (url.pathname.startsWith("/groups/picture/")) {
    const jid = decodeURIComponent(url.pathname.replace("/groups/picture/", ""));
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

  return null;
}
