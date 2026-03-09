import { readdir, writeFile } from "fs/promises";

const main = async () => {
  const files = (await readdir("hg-problem"))
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));

  const lines: string[] = [];
  for (const file of files) {
    const id = file.split(".")[0];
    lines.push(`import problem${id} from "./${file}";`);
  }

  lines.push("");
  lines.push("export const hgProblemMap = {");
  for (const file of files) {
    const id = file.split(".")[0];
    lines.push(`  ${id}: problem${id},`);
  }
  lines.push("} as const;");

  lines.push("");
  lines.push("export const hgProblems = [");
  for (const file of files) {
    const id = file.split(".")[0];
    lines.push(`  { id: ${id}, data: problem${id} },`);
  }
  lines.push("] as const;");

  lines.push("");
  lines.push("export default hgProblemMap;");
  for (const file of files) {
    const id = file.split(".")[0];
    lines.push(`export { problem${id} };`);
  }

  await writeFile("hg-problem/index.ts", `${lines.join("\n")}\n`);
};

main();
