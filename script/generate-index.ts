import { readdir, writeFile } from "fs/promises";

const main = async () => {
  const files = (await readdir("hg-problem"))
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));

  const lines: string[] = [];
  for (const file of files) {
    const id = file.split(".")[0];
    const exportName = `problem${id}`;
    lines.push(`export { default as ${exportName} } from "./${file}";`);
  }

  await writeFile("hg-problem/index.ts", lines.join("\n"));
};

main();
