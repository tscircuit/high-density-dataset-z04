import { readdir, writeFile } from "node:fs/promises";

const toExportName = (file: string) =>
  `result_${file
    .replace(/\.json$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;

export const generateResultsIndex = async () => {
  const files = (await readdir("results"))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const lines = files.map((file) => {
    const exportName = toExportName(file);
    return `export { default as ${exportName} } from "./${file}";`;
  });

  await writeFile("results/index.ts", `${lines.join("\n")}\n`);
};

if (import.meta.main) {
  await generateResultsIndex();
}
