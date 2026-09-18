import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "baileys-joss";
import P from "pino";
import QRCode from "qrcode";

import { join } from "path";
import Bun from "bun"

import { MessageHandler } from "../handlers/message.handler";
import { logger } from "../utils/logger";
import { botState, type GroupInfo } from "./state";

let currentSock: WASocket | null = null;
let connected = false;

export function getSock(): WASocket {
  if (!currentSock) throw new Error("Socket não inicializado");
  return currentSock;
}

export function isWhatsAppConnected(): boolean {
  return connected;
}

export async function connectToWhatsApp(): Promise<WASocket> {
  const authFolder = join(process.cwd(), "src", "data", "auth");
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
  });

  currentSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      try {
        const qrPath = join(process.cwd(), "qr.png");
        await QRCode.toFile(qrPath, qr, { width: 400 });
        logger.info(`QR Code gerado em: ${qrPath}`);

        if (process.platform === "win32") {
          Bun.spawn(["cmd", "/c", "start", "", qrPath]);
        } else if (process.platform === "darwin") {
          Bun.spawn(["open", qrPath]);
        } else {
          Bun.spawn(["xdg-open", qrPath]);
        }
      } catch (err) {
        logger.error(err, "Falha ao gerar o QR Code");
      }
    }

    if (connection === "open") {
      connected = true;
      logger.info("Bot conectado com sucesso!");
      void refreshGroups(sock);
    }

    if (connection === "connecting") {
      connected = false;
    }

    if (connection === "close") {
      connected = false;

      if (
        (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
          ?.statusCode !== DisconnectReason.loggedOut
      ) {
        void connectToWhatsApp();
      }
    }
  });

  const messageHandler = new MessageHandler();
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      await messageHandler.handle(sock, msg);
    }
  });

  return sock;
}

export async function refreshGroups(sock: WASocket): Promise<GroupInfo[]> {
  const groups = await sock.groupFetchAllParticipating();

  const list: GroupInfo[] = [];

  for (const [jid, metadata] of Object.entries(groups)) {
    let hasPicture = false;
    try {
      await sock.profilePictureUrl(jid, "image");
      hasPicture = true;
    } catch {
      hasPicture = false;
    }

    list.push({
      jid,
      name: metadata.subject ?? "(sem nome)",
      hasPicture,
    });
  }

  botState.setGroups(list);

  console.log("\n=== GRUPOS DISPONÍVEIS ===\n");
  for (const g of list) {
    console.log(`Nome: ${g.name}`);
    console.log(`JID:  ${g.jid}`);
    console.log("---");
  }
  console.log(`\nTotal: ${list.length} grupos\n`);

  return list;
}