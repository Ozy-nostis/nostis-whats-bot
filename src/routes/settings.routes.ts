import { settingsStore, type SettingsInput } from "../core/settings-store";
import { banStore } from "../core/ban-store";

export async function handleSettingsRoutes(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/settings" && req.method === "GET") {
    return Response.json(settingsStore.get());
  }

  if (url.pathname === "/settings" && req.method === "PUT") {
    const body = (await req.json()) as SettingsInput;
    return Response.json(settingsStore.update(body));
  }

  if (url.pathname === "/bans" && req.method === "GET") {
    return Response.json({ bans: banStore.list() });
  }

  const banMatch = url.pathname.match(/^\/bans\/([^/]+)$/);
  if (banMatch && req.method === "DELETE") {
    const jid = decodeURIComponent(banMatch[1]!);
    const ok = banStore.unban(jid);
    if (!ok) return new Response("Not found", { status: 404 });
    return Response.json({ ok: true });
  }

  return null;
}
