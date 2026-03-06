import { readdir, rename } from "fs/promises";


const main = async () => {
    const files = await readdir("hg-problem");
    const length = files.length;
    for (let i = 0; i < length; i++) {
        const file = files[i];
        await rename(`hg-problem/${file}`, `hg-problem/${i + 1}.json`);
    }
}

main();