import { profileStore } from "../core/profile-store";
import { keywordStore } from "../core/keyword-store";
import { campaignStore } from "../core/campaign-store";
import { botState } from "../core/state";
import { logger } from "../utils/logger";

function reloadProfileScopedStores(): void {
  keywordStore.reload();
  campaignStore.reload();
  botState.reloadGroupsForProfile();
}

export async function handleProfileRoutes(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/profiles" && req.method === "GET") {
    return Response.json({ profiles: profileStore.list(), activeId: profileStore.activeId });
  }

  if (url.pathname === "/profiles" && req.method === "POST") {
    const body = (await req.json()) as { name?: string; cloneFromId?: string | null };
    if (!body.name?.trim()) {
      return Response.json({ error: "Informe um nome para o perfil." }, { status: 400 });
    }
    try {
      const profile = profileStore.create(body.name, body.cloneFromId ?? null);
      return Response.json({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 400 });
    }
  }

  const profileActivateMatch = url.pathname.match(/^\/profiles\/([^/]+)\/activate$/);
  if (profileActivateMatch && req.method === "POST") {
    const id = decodeURIComponent(profileActivateMatch[1]!);
    try {
      profileStore.setActive(id);
      reloadProfileScopedStores();
      logger.info(`Perfil ativado via dashboard: ${profileStore.getActive().name}`);
      return Response.json({ ok: true, activeId: profileStore.activeId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 400 });
    }
  }

  const profileImportMatch = url.pathname.match(/^\/profiles\/([^/]+)\/import$/);
  if (profileImportMatch && req.method === "POST") {
    const id = decodeURIComponent(profileImportMatch[1]!);
    const body = (await req.json()) as { sourceId?: string };
    if (!body.sourceId) {
      return Response.json({ error: "Selecione um perfil de origem." }, { status: 400 });
    }
    try {
      profileStore.importInto(id, body.sourceId);
      if (id === profileStore.activeId) reloadProfileScopedStores();
      return Response.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 400 });
    }
  }

  const profileMatch = url.pathname.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch) {
    const id = decodeURIComponent(profileMatch[1]!);

    if (req.method === "PUT") {
      const body = (await req.json()) as { name?: string };
      try {
        const profile = profileStore.rename(id, body.name ?? "");
        if (!profile) return new Response("Not found", { status: 404 });
        return Response.json({ profile });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: message }, { status: 400 });
      }
    }

    if (req.method === "DELETE") {
      try {
        const ok = profileStore.delete(id);
        if (!ok) return new Response("Not found", { status: 404 });
        return Response.json({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: message }, { status: 400 });
      }
    }
  }

  return null;
}
