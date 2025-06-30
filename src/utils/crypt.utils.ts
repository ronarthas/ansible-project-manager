import { createHash, randomBytes } from "crypto";
import { log, colors, readInput } from "./console.utils";
/**
 * Generate MD5 hash in Unix crypt format
 */
export function encodeMd5(password: string) {
  const salt = randomBytes(8).toString("base64").slice(0, 8);
  const hash = createHash("md5");
  hash.update(password + salt);
  return `$1$${salt}$${hash.digest("hex")}`;
}

/**
 * Generate SHA512 hash in Unix crypt format
 */
export function encodeSha512(password: string) {
  const salt = randomBytes(16).toString("base64").slice(0, 16);
  const hash = createHash("sha512");
  hash.update(password + salt);
  return `$6$${salt}$${hash.digest("hex")}`;
}

/**
 * Generate secure random password
 */
export function generateSecurePassword(length = 21) {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64")
    .slice(0, length)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Ask for vault password
 */
export async function askVaultPassword() {
  while (true) {
    const password = await readInput(
      `${colors.yellow}🔐 Mot de passe Ansible Vault: ${colors.reset}`,
    );

    if (password.length < 6) {
      log.error("❌ Le mot de passe doit contenir au moins 6 caractères");
      continue;
    }

    const confirm = await readInput(
      `${colors.yellow}🔐 Confirmez le mot de passe: ${colors.reset}`,
    );

    if (password !== confirm) {
      log.error("❌ Les mots de passe ne correspondent pas");
      continue;
    }

    return password;
  }
}
