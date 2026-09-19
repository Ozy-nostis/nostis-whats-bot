import { writeFileSync, mkdirSync, unlinkSync } from "fs";
import { randomUUID, createHash } from "crypto";
import { JsonFileStore } from "./base-store";
import { PATHS } from "../config/paths";
import { CONFIG } from "../config";

export interface LibrarySticker {
  id: string;
  file: string;
  hash: string;
  sourceGroupName: string;
  firstSeenAt: number;
  timesSeen: number;
}

class StickerLibrary extends JsonFileStore<LibrarySticker[]> {
  constructor() {
    super(PATHS.stickerLibrary, []);
  }

  list(): LibrarySticker[] {
    return [...this.data].sort((a, b) => b.firstSeenAt - a.firstSeenAt);
  }

  get(id: string): LibrarySticker | undefined {
    return this.data.find((s) => s.id === id);
  }

  getMediaPath(sticker: LibrarySticker): string {
    return `${PATHS.stickerMedia}/${sticker.file}`;
  }

  /** Chamado quando o bot vê uma figurinha passar em algum grupo. Deduplica por hash do conteúdo. */
  addSeen(buffer: Buffer, groupName: string): void {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const existing = this.data.find((s) => s.hash === hash);
    if (existing) {
      existing.timesSeen++;
      this.save();
      return;
    }

    mkdirSync(PATHS.stickerMedia, { recursive: true });
    const id = randomUUID();
    const filename = `${id}.webp`;
    writeFileSync(`${PATHS.stickerMedia}/${filename}`, buffer);

    this.data.unshift({
      id,
      file: filename,
      hash,
      sourceGroupName: groupName,
      firstSeenAt: Date.now(),
      timesSeen: 1,
    });

    if (this.data.length > CONFIG.maxStickers) {
      const removed = this.data.splice(CONFIG.maxStickers);
      for (const r of removed) {
        try {
          unlinkSync(this.getMediaPath(r));
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
    this.data = this.data.filter((s) => s.id !== id);
    this.save();
    return true;
  }
}

export const stickerLibrary = new StickerLibrary();
