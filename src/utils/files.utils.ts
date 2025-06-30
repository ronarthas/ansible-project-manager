import { log } from "./console.utils";
import { join, resolve, dirname } from "node:path";
import { readdir, access, constants, writeFile, stat } from "fs/promises";
import fs from "fs/promises";
import path from "path";
import color from "picocolors";

/**
 * Check if directory exists, create if not
 */
export async function ensureDirectoryExists(dirPath) {
  try {
    await access(dirPath, constants.F_OK);
  } catch {
    // Directory doesn't exist, create it
    const { mkdir } = await import("fs/promises");
    await mkdir(dirPath, { recursive: true });
    log.success(`📁 Dossier créé: ${dirPath}`);
  }
}

export function replacePlaceholders(text, variables) {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
    // Nettoyer l'expression (enlever espaces)
    const cleanExpr = expression.trim();

    // Cas spécial: {{all}} remplace par tous les noms concaténés
    if (cleanExpr === "all") {
      return Object.values(variables).join("-");
    }

    // Cas spécial: {{all:separator}} avec séparateur custom
    if (cleanExpr.startsWith("all:")) {
      const separator = cleanExpr.split(":")[1] || "";
      return Object.values(variables).join(separator);
    }

    // Cas normal: chercher la variable spécifique
    if (variables.hasOwnProperty(cleanExpr)) {
      return variables[cleanExpr];
    }

    // Si pas trouvé, garder le placeholder original
    return match;
  });
}
async function createStructure(
  basePath,
  structure,
  variables = {},
  options = {},
) {
  const { overwrite = false, skipExisting = true } = options;

  for (let [name, content] of Object.entries(structure)) {
    // Remplacer les variables dans le nom
    const processedName = replacePlaceholders(name, variables);
    const fullPath = path.join(basePath, processedName);

    if (name.endsWith("/")) {
      // C'est un dossier
      try {
        await fs.access(fullPath);
        if (skipExisting) {
          console.log(`📁 Dossier existe déjà: ${fullPath}`);
        }
      } catch {
        // Le dossier n'existe pas, on le crée
        await fs.mkdir(fullPath, { recursive: true });
        console.log(`✅ Dossier créé: ${fullPath}`);
      }

      if (content && typeof content === "object") {
        await createStructure(fullPath, content, variables, options);
      }
    } else {
      // C'est un fichier
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      try {
        await fs.access(fullPath);
        // Le fichier existe
        if (overwrite) {
          const processedContent = content
            ? replacePlaceholders(content, variables)
            : "";
          await fs.writeFile(fullPath, processedContent);
          console.log(`🔄 Fichier écrasé: ${fullPath}`);
        } else {
          console.log(`📄 Fichier existe déjà: ${fullPath}`);
        }
      } catch {
        // Le fichier n'existe pas, on le crée
        const processedContent = content
          ? replacePlaceholders(content, variables)
          : "";
        await fs.writeFile(fullPath, processedContent);
        console.log(`✅ Fichier créé: ${fullPath}`);
      }
    }
  }
}

interface Option {
  value: string;
  label: string;
  hint?: string;
}

export async function generateOptionsFromFolders(
  path: string,
): Promise<Option[]> {
  try {
    const resolvedPath = resolve(path);
    const entries = await readdir(resolvedPath);
    const options: Option[] = [];

    for (const entry of entries) {
      const entryPath = join(resolvedPath, entry);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        const option: Option = {
          value: `${entry}`,
          label: entry,
        };

        // Vérifier s'il y a un fichier hint.txt dans le dossier
        const hintPath = join(entryPath, "hint.txt");
        try {
          const hintFile = Bun.file(hintPath);
          if (await hintFile.exists()) {
            const hintText = await hintFile.text();
            if (hintText.trim()) {
              // 🎨 Colorer le hint en gris/cyan/vert selon tes préférences
              //option.hint = color.gray(hintText.trim()); // Gris discret
              option.hint = color.cyan(hintText.trim()); // Cyan moderne
              // option.hint = color.green(hintText.trim());     // Vert
              // option.hint = color.dim(hintText.trim());       // Atténué
            }
          }
        } catch {
          // Si erreur lors de la lecture du hint, on ignore silencieusement
        }

        options.push(option);
      }
    }

    return options;
  } catch (error) {
    throw new Error(
      `Erreur lors de la lecture du répertoire ${resolvedPath}: ${error}`,
    );
  }
}
