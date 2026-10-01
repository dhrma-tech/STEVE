/**
 * `pnpm secrets:rotate`: re-encrypt every stored secret with the active master key, and move credentials that older
 * versions kept in plain integration config into the vault.
 *
 * Rotation: generate a key (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), put it
 * first in SECRETS_MASTER_KEYS ("k2:<new>,k1:<old>"), deploy, run this, then remove the old key. See docs/runbook.md.
 */
import "./load-env";
import { prisma } from "@/lib/db/client";
import { activeKeyId } from "@/lib/security/crypto";
import { migratePlaintextIntegrationCredentials, rotateStoredSecrets } from "@/lib/security/vault";

async function main() {
  const moved = await migratePlaintextIntegrationCredentials();
  const report = await rotateStoredSecrets();
  console.log(`Active key: ${activeKeyId()}`);
  console.log(`Moved ${moved} plaintext integration credential(s) into the vault.`);
  console.log(`Checked ${report.checked} encrypted value(s); re-encrypted ${report.rewrapped}; ${report.failed} could not be decrypted.`);
  if (report.failed > 0) {
    console.error("Some values are encrypted with a key that is no longer in SECRETS_MASTER_KEYS. Add the old key back and run again.");
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
