import { join } from "path";
import { botState } from "./state";
import { getSock } from "./connection";
import { logger } from "../utils/logger";

const WEB_DIR = join(process.cwd(), "src", "web");

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
        return Response.json({ active: botState.active });
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