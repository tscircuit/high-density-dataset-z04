import { readdir, writeFile } from "node:fs/promises";

const toExportName = (file: string) =>
  `result_${file
    .replace(/\.json$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;

export const generateResultsIndex = async () => {
  const files = (await readdir("results"))
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const lines = files.map(
    (file, index) => `import result${index} from "./${file}";`,
  );

  lines.push("");
  lines.push("export const resultsMap = {");
  for (const [index, file] of files.entries()) {
    const id = file.replace(/\.json$/, "");
    lines.push(`  ${JSON.stringify(id)}: result${index},`);
  }
  lines.push("} as const;");

  lines.push("");
  lines.push("export const results = [");
  for (const [index, file] of files.entries()) {
    const id = file.replace(/\.json$/, "");
    lines.push(`  { id: ${JSON.stringify(id)}, data: result${index} },`);
  }
  lines.push("] as const;");

  lines.push("");
  lines.push("export default resultsMap;");
  for (const [index, file] of files.entries()) {
    lines.push(`export { result${index} as ${toExportName(file)} };`);
  }

  await writeFile("results/index.ts", `${lines.join("\n")}\n`);
};

if (import.meta.main) {
  await generateResultsIndex();
}
