import { callLeadStore, type LeadUpdateInput } from "../core/lead-store";
import { banStore } from "../core/ban-store";
import { callerStore } from "../core/caller-store";

export async function handleLeadRoutes(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/leads" && req.method === "GET") {
    return Response.json({ leads: callLeadStore.list() });
  }

  if (url.pathname === "/callers" && req.method === "GET") {
    return Response.json({ callers: callerStore.list() });
  }

  const leadBanMatch = url.pathname.match(/^\/leads\/([^/]+)\/ban$/);
  if (leadBanMatch && req.method === "POST") {
    const id = decodeURIComponent(leadBanMatch[1]!);
    const lead = callLeadStore.get(id);
    if (!lead) return new Response("Not found", { status: 404 });
    const ban = banStore.ban(lead.callerJid, lead.callerName);
    return Response.json({ ban });
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

  return null;
}
