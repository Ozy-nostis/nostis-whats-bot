import { stickerLibrary } from "../core/sticker-library";

export async function handleStickerRoutes(req: Request, url: URL): Promise<Response | null> {
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

  return null;
}
