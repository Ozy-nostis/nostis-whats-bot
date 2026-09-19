import { homedir, tmpdir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";

export const APP_NAME = "BotBrinzy";

function resolveAppDataDir(): string {
  const appData = process.env["APPDATA"];
  if (appData) {
    return join(appData, APP_NAME);
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", APP_NAME);
  }
  const xdgConfig = process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config");
  return join(xdgConfig, APP_NAME);
}

function resolveTempDir(): string {
  return join(tmpdir(), APP_NAME);
}

export const APPDATA_DIR = resolveAppDataDir();
export const TEMP_DIR = resolveTempDir();

export const PATHS = {
  appData: APPDATA_DIR,
  temp: TEMP_DIR,
  auth: join(APPDATA_DIR, "auth"),
  profiles: join(APPDATA_DIR, "profiles"),
  profilesIndex: join(APPDATA_DIR, "profiles.json"),
  state: join(APPDATA_DIR, "state.json"),
  settings: join(APPDATA_DIR, "settings.json"),
  bans: join(APPDATA_DIR, "bans.json"),
  callers: join(APPDATA_DIR, "callers.json"),
  groupDelays: join(APPDATA_DIR, "group-delays.json"),
  callLeads: join(APPDATA_DIR, "call-leads.json"),
  stickerLibrary: join(APPDATA_DIR, "sticker-library.json"),
  stickerMedia: join(APPDATA_DIR, "sticker-library-media"),
  lockFile: join(TEMP_DIR, "bot.lock"),
  qrCode: join(TEMP_DIR, "qr.png"),
} as const;

export function ensureDirectories(): void {
  mkdirSync(PATHS.appData, { recursive: true });
  mkdirSync(PATHS.temp, { recursive: true });
  mkdirSync(PATHS.auth, { recursive: true });
  mkdirSync(PATHS.profiles, { recursive: true });
  mkdirSync(PATHS.stickerMedia, { recursive: true });
}
