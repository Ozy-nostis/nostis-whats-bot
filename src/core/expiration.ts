import { BUILD_TIMESTAMP } from "./build-info";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function checkExpiration(): void {

  if (BUILD_TIMESTAMP === 0) {
    return;
  }

  const now = Date.now();
  const age = now - BUILD_TIMESTAMP;

  if (age > SEVEN_DAYS_MS) {
    console.error(
      "Arquivo Expirado"
    );
    process.exit(1);
  }
}