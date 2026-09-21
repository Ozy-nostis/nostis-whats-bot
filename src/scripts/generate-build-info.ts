import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const noExpire = process.argv.includes("--no-expire");
const BUILD_TIME = noExpire ? 0 : Date.now();

const content = `// Gerado automaticamente em ${new Date(BUILD_TIME).toISOString()}
// NÃO EDITE MANUALMENTE — este arquivo é reescrito a cada build.
export const BUILD_TIMESTAMP = ${BUILD_TIME};
`;
const dir = join(import.meta.dir, "..", "core");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const target = join(dir, "build-info.ts");
writeFileSync(target, content, "utf-8");

if (noExpire) {
  console.log("build-info.ts gerado SEM expiração (build normal).");
} else {
  console.log(`build-info.ts gerado com expiração de 7 dias (timestamp ${BUILD_TIME}).`);
}