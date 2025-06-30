import * as p from "@clack/prompts";
import color from "picocolors";
import { join } from "node:path";
import { generateOptionsFromFolders } from "./utils/files.utils";
async function main() {
  console.clear();
  p.intro(`${color.bgBlueBright(color.black("- Ansible project manager -"))}`);
  p.log.message(
    `${color.gray("Welcome to the tool for automate a new ansible deploy on a new host")}`,
  );

  const ansibleProject = await generateOptionsFromFolders(
    join(process.cwd(), "src/ansible"),
  );

  const setUpProject = await p.select({
    message: "Select the project to add host",
    options: ansibleProject,
  });

  // const projectTemplate =  await generateOptionsFromFolders(
  //   join(process.cwd(), "src/ansible", setUpProject)
  // )

  console.log(setUpProject);
}

main().catch(console.error);
