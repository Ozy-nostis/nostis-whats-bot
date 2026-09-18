import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { randomUUID, createHash } from "crypto";

export interface LibrarySticker {
  id: string;
  file: string;
  hash: string;
  sourceGroupName: string;
  firstSeenAt: number;
  timesSeen: number;
}

const LIBRARY_FILE = join(process.cwd(), "src", "data", "sticker-library.json");
const MEDIA_DIR = join(process.cwd(), "src", "data", "sticker-library-media");

/** Limite pra não deixar a galeria crescer sem controle; descarta as mais antigas. */
const MAX_STICKERS = 200;

class StickerLibrary {
  private stickers: LibrarySticker[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(LIBRARY_FILE)) {
      this.stickers = [];
      return;
    }
    try {
      this.stickers = JSON.parse(readFileSync(LIBRARY_FILE, "utf-8")) as LibrarySticker[];
    } catch (err) {
      console.error("Falha ao carregar sticker-library.json:", err);
      this.stickers = [];
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(LIBRARY_FILE), { recursive: true });
      writeFileSync(LIBRARY_FILE, JSON.stringify(this.stickers, null, 2), "utf-8");
    } catch (err) {
      console.error("Falha ao salvar sticker-library.json:", err);
    }
  }

  list(): LibrarySticker[] {
    return [...this.stickers].sort((a, b) => b.firstSeenAt - a.firstSeenAt);
  }

  get(id: string): LibrarySticker | undefined {
    return this.stickers.find((s) => s.id === id);
  }

  getMediaPath(sticker: LibrarySticker): string {
    return join(MEDIA_DIR, sticker.file);
  }

  /** Chamado quando o bot vê uma figurinha passar em algum grupo. Deduplica por hash do conteúdo. */
  addSeen(buffer: Buffer, groupName: string): void {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const existing = this.stickers.find((s) => s.hash === hash);
    if (existing) {
      existing.timesSeen++;
      this.save();
      return;
    }

    mkdirSync(MEDIA_DIR, { recursive: true });
    const id = randomUUID();
    const filename = `${id}.webp`;
    writeFileSync(join(MEDIA_DIR, filename), buffer);

    this.stickers.unshift({
      id,
      file: filename,
      hash,
      sourceGroupName: groupName,
      firstSeenAt: Date.now(),
      timesSeen: 1,
    });

    if (this.stickers.length > MAX_STICKERS) {
      const removed = this.stickers.splice(MAX_STICKERS);
      for (const r of removed) {
        try {
          unlinkSync(join(MEDIA_DIR, r.file));
        } catch {
          // ignora
        }
      }
    }

    this.save();
  }

  delete(id: string): boolean {
    const sticker = this.get(id);
    if (!sticker) return false;
    try {
      unlinkSync(this.getMediaPath(sticker));
    } catch {
      // ignora se já não existir
    }
    this.stickers = this.stickers.filter((s) => s.id !== id);
    this.save();
    return true;
  }
}

export const stickerLibrary = new StickerLibrary();
