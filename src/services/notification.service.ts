// src/services/notification.service.ts
import { createNotifier } from "notifier-hook";
import { logger } from "../utils/logger";

export class NotificationService {
  private notifier = createNotifier({ appName: "Meu Bot WhatsApp" });

  constructor() {
    this.notifier.on("error", (err) =>
      logger.error({ err }, "Erro na notificação")
    );
  }

  public async send(title: string, body: string): Promise<void> {
    try {
      await this.notifier.start();
      await this.notifier.show({ title, body });
    } catch (error) {
      logger.error({ error }, "Falha ao enviar notificação");
    }
  }
}