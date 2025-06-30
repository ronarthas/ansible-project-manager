import { Client, ConnectConfig } from "ssh2";
import { readFileSync } from "fs";
import * as p from "@clack/prompts";

// Types pour la configuration SSH
interface SSHConfigBase {
  host: string;
  port?: number;
  username: string;
}

interface SSHConfigPassword extends SSHConfigBase {
  password: string;
}

interface SSHConfigKeyFile extends SSHConfigBase {
  privateKeyPath: string;
  passphrase?: string;
}

interface SSHConfigKeyContent extends SSHConfigBase {
  privateKeyContent: string;
  passphrase?: string;
}

type SSHConfig = SSHConfigPassword | SSHConfigKeyFile | SSHConfigKeyContent;

// Types pour la configuration des fichiers
interface FileConfig {
  localFilePath: string;
  remoteFilePath?: string;
  remoteDirectory?: string;
  preserveFileName?: boolean;
}

// Type pour le résultat d'exécution
interface ExecutionResult {
  code: number;
  output: string;
  errors: string;
  remotePath: string;
  success: boolean;
}

// Type guards pour différencier les types de config SSH
function isPasswordConfig(config: SSHConfig): config is SSHConfigPassword {
  return "password" in config;
}

function isKeyFileConfig(config: SSHConfig): config is SSHConfigKeyFile {
  return "privateKeyPath" in config;
}

function isKeyContentConfig(config: SSHConfig): config is SSHConfigKeyContent {
  return "privateKeyContent" in config;
}

// Configuration SSH - Exemple de structure
const sshConfig: SSHConfig = {
  host: "ton-serveur.com",
  port: 22,
  username: "ton-username",
  password: "ton-mot-de-passe",

  // Pour clé privée par fichier :
  // privateKeyPath: '/home/user/.ssh/id_rsa',
  // passphrase: 'passphrase-optionnelle',

  // Pour clé privée par contenu :
  // privateKeyContent: 'contenu-de-la-cle-privee',
};

// Configuration des fichiers
const fileConfig: FileConfig = {
  localFilePath: "./mon-script.sh",
  remoteFilePath: "/tmp/mon-script-remote.sh",
  preserveFileName: false,
};

async function transferAndExecuteFile(
  sshConf: SSHConfig,
  fileConf: FileConfig,
): Promise<ExecutionResult> {
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      p.log.success("Connexion SSH établie");

      // Déterminer le chemin distant final
      let finalRemotePath: string;
      if (fileConf.preserveFileName) {
        const fileName = fileConf.localFilePath.split("/").pop();
        if (!fileName) {
          reject(new Error("Impossible d'extraire le nom du fichier"));
          return;
        }
        if (!fileConf.remoteDirectory) {
          reject(
            new Error("remoteDirectory requis quand preserveFileName est true"),
          );
          return;
        }
        finalRemotePath = `${fileConf.remoteDirectory}/${fileName}`;
      } else {
        if (!fileConf.remoteFilePath) {
          reject(
            new Error("remoteFilePath requis quand preserveFileName est false"),
          );
          return;
        }
        finalRemotePath = fileConf.remoteFilePath;
      }

      // Établir connexion SFTP
      conn.sftp((err, sftp) => {
        if (err) {
          p.log.error(`Erreur SFTP: ${err.message}`);
          reject(new Error(`Erreur SFTP: ${err.message}`));
          return;
        }

        p.log.info("Connexion SFTP établie");

        // Transférer le fichier
        sftp.fastPut(fileConf.localFilePath, finalRemotePath, (err) => {
          if (err) {
            p.log.error(`Erreur de transfert: ${err.message}`);
            reject(new Error(`Erreur de transfert: ${err.message}`));
            return;
          }

          p.log.success(
            `Fichier transféré: ${fileConf.localFilePath} → ${finalRemotePath}`,
          );

          // Rendre exécutable et exécuter
          const command = `chmod +x "${finalRemotePath}" && "${finalRemotePath}"`;

          conn.exec(command, (err, stream) => {
            if (err) {
              p.log.error(`Erreur d'exécution: ${err.message}`);
              reject(new Error(`Erreur d'exécution: ${err.message}`));
              return;
            }

            p.log.info("Exécution du script en cours...");
            let output = "";
            let errorOutput = "";

            stream.on("close", (code: number) => {
              if (code === 0) {
                p.log.success(`Exécution terminée avec succès (code: ${code})`);
              } else {
                p.log.warn(`Exécution terminée avec code: ${code}`);
              }

              if (output) {
                p.log.info("Sortie standard:");
                p.log.message(output.trim());
              }

              if (errorOutput) {
                p.log.warn("Sortie d'erreur:");
                p.log.message(errorOutput.trim());
              }

              // Nettoyer le fichier temporaire (optionnel)
              conn.exec(`rm "${finalRemotePath}"`, (cleanupErr) => {
                if (cleanupErr) {
                  p.log.warn("Impossible de supprimer le fichier distant");
                } else {
                  p.log.step("Fichier temporaire nettoyé");
                }

                conn.end();
                resolve({
                  code,
                  output: output.trim(),
                  errors: errorOutput.trim(),
                  remotePath: finalRemotePath,
                  success: code === 0,
                });
              });
            });

            stream.on("data", (data: Buffer) => {
              output += data.toString();
            });

            stream.stderr.on("data", (data: Buffer) => {
              errorOutput += data.toString();
            });
          });
        });
      });
    });

    conn.on("error", (err: Error) => {
      p.log.error(`Erreur de connexion SSH: ${err.message}`);
      reject(new Error(`Erreur de connexion SSH: ${err.message}`));
    });

    // Préparer la configuration de connexion
    const connectionConfig: ConnectConfig = {
      host: sshConf.host,
      port: sshConf.port || 22,
      username: sshConf.username,
    };

    // Ajouter l'authentification selon la méthode choisie
    if (isPasswordConfig(sshConf)) {
      connectionConfig.password = sshConf.password;
      p.log.step("Authentification par mot de passe");
    } else if (isKeyFileConfig(sshConf)) {
      try {
        connectionConfig.privateKey = readFileSync(sshConf.privateKeyPath);
        if (sshConf.passphrase) {
          connectionConfig.passphrase = sshConf.passphrase;
        }
        p.log.step(
          `Authentification par clé privée: ${sshConf.privateKeyPath}`,
        );
      } catch (readErr: any) {
        p.log.error(`Impossible de lire la clé privée: ${readErr.message}`);
        reject(
          new Error(`Impossible de lire la clé privée: ${readErr.message}`),
        );
        return;
      }
    } else if (isKeyContentConfig(sshConf)) {
      connectionConfig.privateKey = sshConf.privateKeyContent;
      if (sshConf.passphrase) {
        connectionConfig.passphrase = sshConf.passphrase;
      }
      p.log.step("Authentification par contenu de clé privée");
    } else {
      p.log.error("Aucune méthode d'authentification fournie");
      reject(new Error("Aucune méthode d'authentification fournie"));
      return;
    }

    p.log.info(`Connexion à ${sshConf.host}:${sshConf.port || 22}...`);
    conn.connect(connectionConfig);
  });
}

// Types pour les options de création de config
type AuthType = "password" | "keyfile" | "keycontent";

interface CreateSSHOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  keyPath?: string;
  keyContent?: string;
  passphrase?: string;
}

// Fonction utilitaire pour créer facilement différents types de config
function createSSHConfig(type: AuthType, options: CreateSSHOptions): SSHConfig {
  const baseConfig = {
    host: options.host,
    port: options.port || 22,
    username: options.username,
  };

  switch (type) {
    case "password":
      if (!options.password) {
        throw new Error(
          "Password requis pour l'authentification par mot de passe",
        );
      }
      return { ...baseConfig, password: options.password };

    case "keyfile":
      if (!options.keyPath) {
        throw new Error(
          "keyPath requis pour l'authentification par fichier de clé",
        );
      }
      return {
        ...baseConfig,
        privateKeyPath: options.keyPath,
        passphrase: options.passphrase,
      };

    case "keycontent":
      if (!options.keyContent) {
        throw new Error(
          "keyContent requis pour l'authentification par contenu de clé",
        );
      }
      return {
        ...baseConfig,
        privateKeyContent: options.keyContent,
        passphrase: options.passphrase,
      };

    default:
      throw new Error("Type d'authentification non supporté");
  }
}

// Fonction pour CLI avec spinner et meilleur feedback
async function deployWithFeedback(
  sshConf: SSHConfig,
  fileConf: FileConfig,
): Promise<ExecutionResult> {
  const s = p.spinner();

  try {
    s.start("Préparation du déploiement...");

    const result = await transferAndExecuteFile(sshConf, fileConf);

    s.stop();

    if (result.success) {
      p.log.success("Déploiement terminé avec succès !");

      if (result.output) {
        p.log.info("Résultat:");
        p.log.message(result.output);
      }
    } else {
      p.log.warn(`Déploiement terminé avec des erreurs (code: ${result.code})`);

      if (result.errors) {
        p.log.error("Erreurs:");
        p.log.message(result.errors);
      }
    }

    return result;
  } catch (error: any) {
    s.stop();
    p.log.error("Échec du déploiement");
    p.log.message(error.message);
    throw error;
  }
}

// Export des types et fonctions principales
export {
  type SSHConfig,
  type SSHConfigPassword,
  type SSHConfigKeyFile,
  type SSHConfigKeyContent,
  type FileConfig,
  type ExecutionResult,
  type AuthType,
  type CreateSSHOptions,
  transferAndExecuteFile,
  createSSHConfig,
  deployWithFeedback,
};

// Utilisation principale
(async (): Promise<void> => {
  p.intro("🔧 SSH Deploy Tool");

  try {
    const result = await deployWithFeedback(sshConfig, fileConfig);

    if (result.success) {
      p.outro("🎉 Déploiement réussi !");
    } else {
      p.outro("⚠️ Déploiement terminé avec des avertissements");
    }
  } catch (error: any) {
    p.outro("💥 Échec du déploiement");
    process.exit(1);
  }
})();
