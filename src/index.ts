// src/index.ts
import { acquireLock } from "./core/single-instance";
import { connectToWhatsApp } from "./core/connection";
import { logger } from "./utils/logger";
import { startDashboard } from "./core/dashboard";

async function main() {
  acquireLock();
  startDashboard(3000);
  await connectToWhatsApp();
}

main().catch((error) => {
  logger.fatal({ error }, "Erro fatal na inicialização");
  process.exit(1);
});