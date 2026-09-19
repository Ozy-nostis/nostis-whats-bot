import { botState } from "../core/state";
import { isWhatsAppConnected } from "../core/connection";
import { logger } from "../utils/logger";

export async function handleBotRoutes(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/status" && req.method === "GET") {
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

  return null;
}
