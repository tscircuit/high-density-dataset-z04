import { mkdir, readdir, writeFile } from "fs/promises";

type ProblemNode = {
  width?: number;
  height?: number;
};

const toNumericId = (fileName: string) => Number(fileName.split(".")[0]);

const isLargeNode = (problem: ProblemNode) =>
  typeof problem.width === "number" &&
  typeof problem.height === "number" &&
  problem.width >= 5 &&
  problem.height >= 5;

const main = async () => {
  const files = (await readdir("hg-problem"))
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => toNumericId(a) - toNumericId(b));

  await mkdir("z04-large", { recursive: true });

  const largeFiles: string[] = [];
  for (const file of files) {
    const json = (await Bun.file(`hg-problem/${file}`).json()) as ProblemNode;
    if (isLargeNode(json)) {
      largeFiles.push(file);
    }
  }

  const lines: string[] = [];
  for (const file of largeFiles) {
    const id = file.split(".")[0];
    lines.push(`import problem${id} from "../hg-problem/${file}";`);
  }

  lines.push("");
  lines.push("export const z04LargeProblemMap = {");
  for (const file of largeFiles) {
    const id = file.split(".")[0];
    lines.push(`  ${id}: problem${id},`);
  }
  lines.push("} as const;");

  lines.push("");
  lines.push("export const z04LargeProblems = [");
  for (const file of largeFiles) {
    const id = file.split(".")[0];
    lines.push(`  { id: ${id}, data: problem${id} },`);
  }
  lines.push("] as const;");

  lines.push("");
  lines.push("export default z04LargeProblemMap;");
  for (const file of largeFiles) {
    const id = file.split(".")[0];
    lines.push(`export { problem${id} };`);
  }

  await writeFile("z04-large/index.ts", `${lines.join("\n")}\n`);
};

main();
