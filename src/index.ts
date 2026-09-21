// src/index.ts
import { ensureDirectories } from "./config/paths";
import { acquireLock } from "./core/single-instance";
import { connectToWhatsApp } from "./core/connection";
import { logger } from "./utils/logger";
import { startDashboard } from "./core/dashboard";
import { checkExpiration } from "./core/expiration";

async function main() {
  checkExpiration();
  ensureDirectories();
  acquireLock();
  startDashboard();
  await connectToWhatsApp();
}

main().catch((error) => {
  logger.fatal({ error }, "Erro fatal na inicialização");
  process.exit(1);
});