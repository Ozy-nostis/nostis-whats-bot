import { handleApiRequest } from "../routes";
import { WEB_ASSETS } from "../web/assets";
import { logger } from "../utils/logger";
import { CONFIG } from "../config";

export function startDashboard(port = CONFIG.defaultPort): void {
  Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);

      // Rotas da API Modularizada
      const apiResponse = await handleApiRequest(req, url);
      if (apiResponse) return apiResponse;

      // Assets Estáticos Embutidos em Memória (Sem dependência de disco / serveFile)
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(WEB_ASSETS.html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (url.pathname === "/style.css") {
        return new Response(WEB_ASSETS.css, {
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      if (url.pathname === "/app.js") {
        return new Response(WEB_ASSETS.js, {
          headers: {
            "Content-Type": "text/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  logger.info(`Dashboard disponível em http://localhost:${port}`);
}