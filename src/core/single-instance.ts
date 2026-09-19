import { existsSync, writeFileSync, unlinkSync, readFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { PATHS } from "../config/paths";

const LOCK_FILE_PATH = PATHS.lockFile;

function isProcessAlive(pid: number): boolean {
  try {
    // Sinal 0 não mata o processo, só verifica se ele existe
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(): void {
  mkdirSync(dirname(LOCK_FILE_PATH), { recursive: true });

  if (existsSync(LOCK_FILE_PATH)) {
    const content = readFileSync(LOCK_FILE_PATH, "utf-8").trim();
    const pid = Number(content);

    if (!Number.isNaN(pid) && pid !== process.pid && isProcessAlive(pid)) {
      console.error(`O bot já está em execução (PID ${pid}). Encerrando esta instância.`);
      process.exit(1);
    }

    // Lock órfão — sobrescreve
    console.warn(`Lock órfão detectado (PID ${content} não está rodando). Removendo...`);
    try {
      unlinkSync(LOCK_FILE_PATH);
    } catch {
      // ignora
    }
  }

  try {
    writeFileSync(LOCK_FILE_PATH, process.pid.toString(), { flag: "wx" });
    console.log(`Lock adquirido (PID ${process.pid}).`);

    process.on("exit", releaseLock);
    process.on("SIGINT", () => process.exit());
    process.on("SIGTERM", () => process.exit());
  } catch (error) {
    console.error("Falha ao adquirir o lock.", error);
    process.exit(1);
  }
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_FILE_PATH)) {
      const content = readFileSync(LOCK_FILE_PATH, "utf-8").trim();
      // Só remove se o lock for nosso
      if (Number(content) === process.pid) {
        unlinkSync(LOCK_FILE_PATH);
        console.log("Lock liberado.");
      }
    }
  } catch (error) {
    console.error("Erro ao liberar o lock:", error);
  }
}